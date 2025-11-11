const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");
const { sendPackageConfirmation } = require("../utils/email");

const hitpayClient = axios.create({
  baseURL: process.env.HITPAY_API_URL,
  headers: {
    "X-BUSINESS-API-KEY": process.env.HITPAY_API_KEY,
    "Content-Type": "application/json" 
  }
});

exports.createPackagePayment = async (req, res) => {
  try {
    const {
      userPackageId,
      orderId,
      amount,
      customerInfo,
      redirectUrl,
      webhookUrl,
      paymentMethod = "card"
    } = req.body;

    if (!userPackageId || !orderId || !amount || !customerInfo || !redirectUrl || !webhookUrl) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId, orderId, amount, customerInfo, redirectUrl, and webhookUrl are required"
      });
    }

    // Sanitize phone number: remove all non-numeric characters except leading +
    // and limit to 15 characters to comply with HitPay API requirements
    let sanitizedPhone = "";
    if (customerInfo.phone) {
      // Remove spaces, parentheses, dashes, and other formatting characters
      sanitizedPhone = customerInfo.phone.replace(/[\s\(\)\-]/g, '');
      // Limit to 15 characters
      if (sanitizedPhone.length > 15) {
        sanitizedPhone = sanitizedPhone.substring(0, 15);
      }
    }

    const payload = {
      amount: parseFloat(amount),
      currency: "SGD",
      email: customerInfo.email,
      name: customerInfo.name,
      purpose: `Package Purchase - Order: ${orderId}`,
      reference_number: orderId,
      redirect_url: redirectUrl,
      webhook: "https://productive-space-backend.vercel.app/api/payment/webhook",
      payment_methods: [paymentMethod],
      phone: sanitizedPhone,
      send_email: false,
      send_sms: false,
      allow_repeated_payments: false
    };

    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === "") {
        delete payload[key];
      }
    });

    const response = await hitpayClient.post("/v1/payment-requests", payload);
    
    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod,
        updatedAt: new Date().toISOString()
      })
      .eq("id", userPackageId)
      .eq("orderId", orderId);

    if (updateError) {
      console.error("Package purchase update error:", updateError);
    }

    res.json({
      success: true,
      ...response.data,
      userPackageId: userPackageId,
      orderId: orderId,
      message: "Payment request created successfully"
    });

  } catch (error) {
    res.status(500).json({ 
      error: "Payment creation failed",
      message: error.response?.data?.message || error.message,
      details: error.response?.status ? `HTTP ${error.response.status}` : 'Network Error'
    });
  }
};


exports.handlePackageWebhook = async (req, res) => {
  try {
    const event = req.body;
    
    let paymentDetails = null;
    try {
      const response = await hitpayClient.get(`/v1/payment-requests/${event.payment_request_id}`);
      paymentDetails = response.data;
    } catch (apiError) {
      console.error("Failed to fetch payment details:", apiError.response?.data || apiError.message);
    }

    const { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packageType,
          targetRole,
          passCount
        )
      `)
      .eq("orderId", event.reference_number)
      .single();

    if (findError || !packagePurchase) {
      return res.status(404).send("Package purchase not found");
    }

    if (event.status === 'completed') {
      const originalAmount = parseFloat(packagePurchase.totalAmount);
      const paidAmount = parseFloat(event.amount);
      const isCardPayment = paidAmount > originalAmount && Math.abs(paidAmount - (originalAmount * 1.05)) < 0.01;
      
      const activatedAt = new Date().toISOString();
      const validityDays = packagePurchase.Package.validityDays || 30;
      const expiresAt = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString();

      const { error: updateError } = await supabase
        .from("PackagePurchase")
        .update({
          paymentStatus: "COMPLETED",
          paymentMethod: event.payment_method || paymentDetails?.payment_methods?.[0] || "Online",
          activatedAt: activatedAt,
          expiresAt: expiresAt,
          updatedAt: new Date().toISOString()
        })
        .eq("id", packagePurchase.id);

      if (updateError) {
        return res.status(500).send("Failed to update package purchase");
      }

      // Update the packagePurchase object with the new dates before passing to createUserPasses
      packagePurchase.activatedAt = activatedAt;
      packagePurchase.expiresAt = expiresAt;
      packagePurchase.paymentMethod = event.payment_method || paymentDetails?.payment_methods?.[0] || "Online";
      
      await createUserPasses(packagePurchase);

      console.log("Package purchase completed successfully:", packagePurchase.id);
      
    } else if (event.status === 'failed' || event.status === 'cancelled') {
      const { error: updateError } = await supabase
        .from("PackagePurchase")
        .update({
          paymentStatus: "FAILED",
          updatedAt: new Date().toISOString()
        })
        .eq("id", packagePurchase.id);

      if (updateError) {
        console.error("Package purchase update error:", updateError);
      }

      console.log("Package purchase failed:", packagePurchase.id);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Package webhook handler error:", err.message);
    res.status(500).send("Internal Server Error");
  }
};

async function createUserPasses(packagePurchase) {
  try {
   
    if (!packagePurchase || !packagePurchase.Package) {
      throw new Error("Package data is missing or incomplete");
    }
    
    if (!packagePurchase.id || !packagePurchase.userId) {
      throw new Error("Package purchase ID or user ID is missing");
    }
    
    const userPasses = [];

    const passCount = packagePurchase.Package.passCount || 0;
    console.log("Pass count from package:", passCount);
    
    if (passCount > 0) {
      const packageType = packagePurchase.Package.packageType;
      if (!packageType || !['HALF_DAY', 'FULL_DAY', 'SEMESTER_BUNDLE'].includes(packageType)) {
        throw new Error(`Invalid package type: ${packageType}`);
      }
      
    
      const validityDays = packagePurchase.Package.validityDays || 30;
      console.log("Package type:", packageType, "Validity days:", validityDays);
      
     
      userPasses.push({
        id: uuidv4(),
        packagepurchaseid: packagePurchase.id,
        userId: packagePurchase.userId,
        passtype: packageType,
        totalCount: passCount, 
        remainingCount: passCount,
        status: "ACTIVE",
        hours: packagePurchase.Package.hoursAllowed || 4, // Add hours field
        usedat: null,
        bookingid: null,
        locationid: null,
        starttime: null,
        endtime: null,
        expiresAt: new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString(),
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      });
    }


    if (userPasses.length > 0) {
      // Check if UserPass already exists to prevent duplicates
      const { data: existingPasses, error: checkError } = await supabase
        .from("UserPass")
        .select("id")
        .eq("packagepurchaseid", packagePurchase.id);

      if (checkError) {
        console.error("❌ Error checking existing UserPass:", checkError);
        throw checkError;
      }

      if (existingPasses && existingPasses.length > 0) {
        console.log(`⚠️ UserPass already exists for purchase ${packagePurchase.id} (${existingPasses.length} records found), skipping creation`);
        return;
      }

      // Try to insert, but handle duplicate key errors gracefully
      const { error: insertError } = await supabase
        .from("UserPass")
        .insert(userPasses);

      if (insertError) {
        // If it's a duplicate key error, just log and return (race condition happened)
        if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
          console.log(`⚠️ UserPass creation skipped - already exists (race condition) for purchase ${packagePurchase.id}`);
          return;
        }
        console.error("❌ Error creating UserPass:", insertError);
        throw insertError;
      }

      console.log(`✅ Created ${userPasses.length} user passes for package purchase:`, packagePurchase.id);
      
      // Send package confirmation email with PDF
      console.log("📧 Starting package confirmation email process...");
      try {
        // Get user data for email
        console.log("👤 Fetching user data for user ID:", packagePurchase.userId);
        const { data: userData, error: userError } = await supabase
          .from("User")
          .select("id, email, firstName, lastName")
          .eq("id", packagePurchase.userId)
          .single();

        if (userError || !userData) {
          console.error("❌ Error fetching user data for package email:", userError);
        } else {
          console.log("✅ User data fetched:", {
            id: userData.id,
            email: userData.email,
            name: userData.firstName || userData.lastName || "N/A"
          });

          // Calculate amounts with dynamic fees
          const { getPaymentSettings } = require('../utils/paymentFeeHelper');
          const feeSettings = await getPaymentSettings();
          const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
          const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;
          
          const baseAmount = parseFloat(packagePurchase.totalAmount) || 0;
          const paymentMethod = packagePurchase.paymentMethod || "Online Payment";
          const isCardPayment = paymentMethod.toLowerCase().includes('card');
          const isPayNow = paymentMethod.toLowerCase().includes('paynow');
          
          const cardFee = isCardPayment ? baseAmount * (cardFeePercentage / 100) : 0; // Dynamic % card fee
          const payNowFee = (isPayNow && baseAmount < 10) ? paynowFeeAmount : 0; // Dynamic PayNow fee - ONLY < $10
          const finalAmount = baseAmount + cardFee + payNowFee;

          console.log("💰 Payment calculation:", {
            baseAmount: baseAmount,
            paymentMethod: paymentMethod,
            isCardPayment: isCardPayment,
            isPayNow: isPayNow,
            cardFee: cardFee,
            payNowFee: payNowFee,
            finalAmount: finalAmount
          });

          // Prepare package data for email
          const packageEmailData = {
            id: packagePurchase.id || "N/A",
            orderId: packagePurchase.orderId || "N/A",
            packageName: packagePurchase.Package?.name || "N/A",
            packageType: packagePurchase.Package?.packageType || "N/A",
            targetRole: packagePurchase.Package?.targetRole || "Student",
            passCount: packagePurchase.Package?.passCount || 1,
            hoursAllowed: packagePurchase.Package?.hoursAllowed || 4,
            validityDays: packagePurchase.Package?.validityDays || 30,
            baseAmount: baseAmount,
            cardFee: cardFee,
            payNowFee: payNowFee,
            totalAmount: finalAmount,
            paymentMethod: paymentMethod,
            activatedAt: packagePurchase.activatedAt || new Date().toISOString(),
            expiresAt: packagePurchase.expiresAt || new Date().toISOString(),
            purchasedAt: packagePurchase.createdAt || new Date().toISOString()
          };

          console.log("📦 Package email data prepared:", {
            packageName: packageEmailData.packageName,
            passCount: packageEmailData.passCount,
            totalAmount: packageEmailData.totalAmount,
            orderId: packageEmailData.orderId
          });

          console.log("📤 Sending package confirmation email...");
          const emailResult = await sendPackageConfirmation(userData, packageEmailData);
          
          if (emailResult.success) {
            console.log("✅ Package confirmation email sent successfully!");
            console.log("📧 Email Message ID:", emailResult.messageId);
            console.log("📧 Email sent to:", userData.email);
          } else {
            console.error("❌ Error sending package confirmation email:", emailResult.error);
          }
        }
      } catch (emailError) {
        console.error("❌ Error in package confirmation email process:", emailError);
        console.error("❌ Error stack:", emailError.stack);
      }
    } else {
      console.log("No user passes to create for package purchase:", packagePurchase.id);
    }

  } catch (error) {
    console.error("Error in createUserPasses:", error);
    throw error;
  }
}

exports.getPackagePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const { data: packagePurchase, error } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packageType,
          targetRole
        )
      `)
      .eq("orderId", orderId)
      .single();

    if (error || !packagePurchase) {
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified order does not exist"
      });
    }

    res.json({
      success: true,
      orderId: packagePurchase.orderId,
      paymentStatus: packagePurchase.paymentStatus,
      packageName: packagePurchase.Package.name,
      packageType: packagePurchase.Package.packageType,
      targetRole: packagePurchase.Package.targetRole,
      totalAmount: packagePurchase.totalAmount,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString(),
      isExpired: false
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to get payment status"
    });
  }
};

exports.confirmPackagePayment = async (req, res) => {
  try {
    const { userPackageId, orderId, hitpayReference } = req.body;

    if (!userPackageId || !orderId) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId and orderId are required"
      });
    }

    let { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packageType,
          targetRole,
          passCount,
          validityDays
        ),
        User (
          id,
          email,
          firstName,
          lastName,
          memberType
        )
      `)
      .eq("id", userPackageId)
      .single();

    if (findError || !packagePurchase) {
      const { data: packagePurchaseByOrder, error: findErrorByOrder } = await supabase
        .from("PackagePurchase")
        .select(`
          *,
          Package (
            id,
            name,
            packageType,
            targetRole,
            passCount,
            validityDays
          ),
          User (
            id,
            email,
            firstName,
            lastName,
            memberType
          )
        `)
        .eq("orderId", orderId)
        .single();
      
      packagePurchase = packagePurchaseByOrder;
      findError = findErrorByOrder;
    }

    if (findError || !packagePurchase) {
   
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified package purchase does not exist"
      });
    }

    if (packagePurchase.paymentStatus === "COMPLETED") {
      // Calculate fee breakdown
      const baseAmount = parseFloat(packagePurchase.totalAmount);
      const paymentMethod = packagePurchase.paymentMethod || "Online Payment";
      const isCardPayment = paymentMethod.toLowerCase().includes('card');
      const isPayNow = paymentMethod.toLowerCase().includes('paynow');
      
      // Get dynamic fee settings
      const { getPaymentSettings } = require('../utils/paymentFeeHelper');
      const feeSettings = await getPaymentSettings();
      const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
      const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;
      
      let cardFee = 0;
      let payNowFee = 0;
      
      if (isCardPayment) {
        cardFee = baseAmount * (cardFeePercentage / 100); // Dynamic % card fee
      } else if (isPayNow && baseAmount < 10) {
        payNowFee = paynowFeeAmount; // Dynamic PayNow fee - ONLY < $10
      }
      
      const finalTotal = baseAmount + cardFee + payNowFee;
      
      return res.json({
        success: true,
        message: "Payment already confirmed",
        data: {
          userPackageId: packagePurchase.id,
          orderId: packagePurchase.orderId,
          paymentStatus: packagePurchase.paymentStatus,
          hitpayReference: hitpayReference,
          packageName: packagePurchase.Package.name,
          packageType: packagePurchase.Package.packageType,
          targetRole: packagePurchase.Package.targetRole,
          baseAmount: baseAmount,
          cardFee: cardFee,
          payNowFee: payNowFee,
          totalAmount: finalTotal,
          paymentMethod: paymentMethod,
          activatedAt: packagePurchase.activatedAt || new Date().toISOString(),
          expiresAt: packagePurchase.expiresAt || new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString(),
          userInfo: {
            email: packagePurchase.User.email,
            name: `${packagePurchase.User.firstName} ${packagePurchase.User.lastName}`,
            memberType: packagePurchase.User.memberType
          },
          passCount: packagePurchase.Package.passCount,
          validityDays: packagePurchase.Package.validityDays
        }
      });
    }

 
    const activatedAt = new Date().toISOString();
    const validityDays = packagePurchase.Package.validityDays || 30;
    const expiresAt = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString();

    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentStatus: "COMPLETED",
        activatedAt: activatedAt,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString()
      })
      .eq("id", userPackageId);

    if (updateError) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package purchase"
      });
    }

    // Update the packagePurchase object with the new dates before passing to createUserPasses
    packagePurchase.activatedAt = activatedAt;
    packagePurchase.expiresAt = expiresAt;

    try {
      await createUserPasses(packagePurchase);
    } catch (createPassesError) {
      console.error("Error creating user passes:", createPassesError);
      // Don't retry - the duplicate check will prevent issues
      // If it failed, it will be created on first booking attempt
    }

    // Calculate fee breakdown for response
    const baseAmount = parseFloat(packagePurchase.totalAmount);
    const paymentMethod = packagePurchase.paymentMethod || "Online Payment";
    const isCardPayment = paymentMethod.toLowerCase().includes('card');
    const isPayNow = paymentMethod.toLowerCase().includes('paynow');
    
    // Get dynamic fee settings
    const { getPaymentSettings } = require('../utils/paymentFeeHelper');
    const feeSettings = await getPaymentSettings();
    const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
    const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;
    
    let cardFee = 0;
    let payNowFee = 0;
    
    if (isCardPayment) {
      cardFee = baseAmount * (cardFeePercentage / 100); // Dynamic % card fee
    } else if (isPayNow) {
      payNowFee = paynowFeeAmount; // Dynamic PayNow fee
    }
    
    const finalTotal = baseAmount + cardFee + payNowFee;
    
    const responseData = {
      userPackageId: packagePurchase.id,
      orderId: packagePurchase.orderId,
      paymentStatus: "COMPLETED",
      hitpayReference: hitpayReference,
      packageName: packagePurchase.Package.name,
      packageType: packagePurchase.Package.packageType,
      targetRole: packagePurchase.Package.targetRole,
      baseAmount: baseAmount,
      cardFee: cardFee,
      payNowFee: payNowFee,
      totalAmount: finalTotal,
      paymentMethod: paymentMethod,
      activatedAt: activatedAt,
      expiresAt: expiresAt,
      userInfo: {
        email: packagePurchase.User.email,
        name: `${packagePurchase.User.firstName} ${packagePurchase.User.lastName}`,
        memberType: packagePurchase.User.memberType
      },
      passCount: packagePurchase.Package.passCount,
      validityDays: packagePurchase.Package.validityDays
    };

  
    res.json({
      success: true,
      message: "Package payment confirmed successfully",
      data: responseData
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to confirm package payment"
    });
  }
};

exports.manualCompletePayment = async (req, res) => {
  try {
    const { userPackageId, hitpayReference } = req.body;

    if (!userPackageId || !hitpayReference) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId and hitpayReference are required"
      });
    }

    const { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packageType,
          targetRole,
          passCount,
          validityDays
        )
      `)
      .eq("id", userPackageId)
      .single();

    if (findError || !packagePurchase) {
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified package purchase does not exist"
      });
    }

    const activatedAt = new Date().toISOString();
    const validityDays = packagePurchase.Package.validityDays || 30;
    const expiresAt = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString();

    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentStatus: "COMPLETED",
        activatedAt: activatedAt,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString()
      })
      .eq("id", userPackageId);

    if (updateError) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package purchase"
      });
    }

    // Update the packagePurchase object with the new dates before passing to createUserPasses
    packagePurchase.activatedAt = activatedAt;
    packagePurchase.expiresAt = expiresAt;

    await createUserPasses(packagePurchase);

    res.json({
      success: true,
      message: "Payment completed successfully",
      data: {
        userPackageId: userPackageId,
        orderId: packagePurchase.orderId,
        paymentStatus: "COMPLETED",
        hitpayReference: hitpayReference,
        activatedAt: activatedAt,
        expiresAt: expiresAt
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to complete payment manually"
    });
  }
};

