const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");

const hitpayClient = axios.create({
  baseURL: process.env.HITPAY_API_URL,
  headers: {
    "X-BUSINESS-API-KEY": process.env.HITPAY_API_KEY,
    "Content-Type": "application/json" 
  }
});

// 🎯 Create payment for package purchase
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

    // Validate required fields
    if (!userPackageId || !orderId || !amount || !customerInfo || !redirectUrl || !webhookUrl) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId, orderId, amount, customerInfo, redirectUrl, and webhookUrl are required"
      });
    }

    // Prepare HitPay payload (EXACTLY like booking payment)
    const payload = {
      amount: parseFloat(amount),
      currency: "SGD",
      email: customerInfo.email,
      name: customerInfo.name,
      purpose: `Package Purchase - Order: ${orderId}`,
      reference_number: orderId,
      redirect_url: redirectUrl,
      webhook: "https://productive-space-backend.vercel.app/api/payment/webhook", // Use same webhook as bookings
      payment_methods: [paymentMethod],
      phone: customerInfo.phone || "",
      send_email: false,
      send_sms: false,
      allow_repeated_payments: false
    };

    // Remove undefined values (EXACTLY like booking payment)
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === "") {
        delete payload[key];
      }
    });

    // Create payment request with HitPay (EXACTLY like booking payment)
    const response = await hitpayClient.post("/v1/payment-requests", payload);
    
    // Update package purchase with payment info (simplified)
    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentstatus: "PENDING",
        paymentmethod: paymentMethod,
        updatedat: new Date().toISOString()
      })
      .eq("id", userPackageId)
      .eq("orderid", orderId);

    if (updateError) {
      console.error("Package purchase update error:", updateError);
      // Don't fail the payment creation, just log the error
      console.log("Payment created but failed to update package purchase status");
    }

    // Return HitPay response (EXACTLY like booking payment)
    res.json({
      success: true,
      ...response.data,
      userPackageId: userPackageId,
      orderId: orderId,
      message: "Payment request created successfully"
    });

  } catch (error) {
    console.error("Package payment creation error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "Payment creation failed",
      message: error.response?.data?.message || error.message,
      details: error.response?.status ? `HTTP ${error.response.status}` : 'Network Error'
    });
  }
};

// 🎯 Handle package payment webhook
exports.handlePackageWebhook = async (req, res) => {
  try {
    const event = req.body;
    
    // Fetch payment details from HitPay
    let paymentDetails = null;
    try {
      const response = await hitpayClient.get(`/v1/payment-requests/${event.payment_request_id}`);
      paymentDetails = response.data;
    } catch (apiError) {
      console.error("Failed to fetch payment details:", apiError.response?.data || apiError.message);
    }

    // Find the package purchase by order ID
    const { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents
        )
      `)
      .eq("orderid", event.reference_number)
      .single();

    if (findError || !packagePurchase) {
      console.error("Package purchase not found for order:", event.reference_number);
      return res.status(404).send("Package purchase not found");
    }

    // Update payment status based on webhook event
    if (event.status === 'completed') {
      // Calculate if this was a card payment (check if amount includes 5% fee)
      const originalAmount = parseFloat(packagePurchase.totalamount);
      const paidAmount = parseFloat(event.amount);
      const isCardPayment = paidAmount > originalAmount && Math.abs(paidAmount - (originalAmount * 1.05)) < 0.01;
      
      // Update package purchase to completed
      const { error: updateError } = await supabase
        .from("PackagePurchase")
        .update({
          paymentstatus: "COMPLETED",
          paymentmethod: event.payment_method || paymentDetails?.payment_methods?.[0] || "Online",
          hitpayreference: event.payment_request_id,
          activatedat: new Date().toISOString(),
          expiresat: new Date(Date.now() + (packagePurchase.Package.validitydays * 24 * 60 * 60 * 1000)).toISOString(),
          updatedat: new Date().toISOString()
        })
        .eq("id", packagePurchase.id);

      if (updateError) {
        console.error("Package purchase update error:", updateError);
        return res.status(500).send("Failed to update package purchase");
      }

      // Create UserPass records based on package contents
      await createUserPasses(packagePurchase);

      console.log("Package purchase completed successfully:", packagePurchase.id);
      
    } else if (event.status === 'failed' || event.status === 'cancelled') {
      // Update package purchase to failed
      const { error: updateError } = await supabase
        .from("PackagePurchase")
        .update({
          paymentstatus: "FAILED",
          updatedat: new Date().toISOString()
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

// 🎯 Helper function to create UserPass records
async function createUserPasses(packagePurchase) {
  try {
    const packageContents = packagePurchase.Package.packagecontents;
    const userPasses = [];

    // Create half-day passes
    if (packageContents.halfDayPasses && packageContents.halfDayPasses > 0) {
      for (let i = 0; i < packageContents.halfDayPasses; i++) {
        userPasses.push({
          id: uuidv4(),
          packagepurchaseid: packagePurchase.id,
          passtype: "HALF_DAY",
          hours: packageContents.halfDayHours || 6,
          status: "ACTIVE",
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString()
        });
      }
    }

    // Create full-day passes
    if (packageContents.fullDayPasses && packageContents.fullDayPasses > 0) {
      for (let i = 0; i < packageContents.fullDayPasses; i++) {
        userPasses.push({
          id: uuidv4(),
          packagepurchaseid: packagePurchase.id,
          passtype: "FULL_DAY",
          hours: packageContents.fullDayHours || 12,
          status: "ACTIVE",
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString()
        });
      }
    }

    // Create semester passes (if applicable)
    if (packagePurchase.Package.packagetype === "SEMESTER_BUNDLE") {
      userPasses.push({
        id: uuidv4(),
        packagepurchaseid: packagePurchase.id,
        passtype: "SEMESTER",
        hours: packageContents.totalHours || 200,
        status: "ACTIVE",
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      });
    }

    // Insert all user passes
    if (userPasses.length > 0) {
      const { error: insertError } = await supabase
        .from("UserPass")
        .insert(userPasses);

      if (insertError) {
        console.error("Error creating user passes:", insertError);
        throw insertError;
      }

      console.log(`Created ${userPasses.length} user passes for package purchase:`, packagePurchase.id);
    }

  } catch (error) {
    console.error("Error in createUserPasses:", error);
    throw error;
  }
}

// 🎯 Get payment status for a package purchase
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
          packagetype,
          targetrole
        )
      `)
      .eq("orderid", orderId)
      .single();

    if (error || !packagePurchase) {
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified order does not exist"
      });
    }

    res.json({
      success: true,
      orderId: packagePurchase.orderid,
      paymentStatus: packagePurchase.paymentstatus,
      packageName: packagePurchase.Package.name,
      packageType: packagePurchase.Package.packagetype,
      targetRole: packagePurchase.Package.targetrole,
      totalAmount: packagePurchase.totalamount,
      activatedAt: packagePurchase.activatedat,
      expiresAt: packagePurchase.expiresat,
      isExpired: packagePurchase.expiresat ? new Date() > new Date(packagePurchase.expiresat) : false
    });

  } catch (err) {
    console.error("Get payment status error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to get payment status"
    });
  }
};

// 🎯 Confirm package payment (for frontend redirect)
exports.confirmPackagePayment = async (req, res) => {
  try {
    const { userPackageId, orderId, hitpayReference } = req.body;

    console.log("Confirm package payment request:", { userPackageId, orderId, hitpayReference });

    if (!userPackageId || !orderId) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId and orderId are required"
      });
    }

    // Get package purchase details (try by ID first, then by order ID)
    let { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents,
          validitydays
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

    // If not found by ID, try by order ID
    if (findError || !packagePurchase) {
      const { data: packagePurchaseByOrder, error: findErrorByOrder } = await supabase
        .from("PackagePurchase")
        .select(`
          *,
          Package (
            id,
            name,
            packagetype,
            targetrole,
            packagecontents,
            validitydays
          ),
          User (
            id,
            email,
            firstName,
            lastName,
            memberType
          )
        `)
        .eq("orderid", orderId)
        .single();
      
      packagePurchase = packagePurchaseByOrder;
      findError = findErrorByOrder;
    }

    if (findError || !packagePurchase) {
      console.log("Package purchase not found. Error:", findError);
      console.log("Searched for userPackageId:", userPackageId, "orderId:", orderId);
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified package purchase does not exist"
      });
    }

    console.log("Found package purchase:", packagePurchase.id, packagePurchase.orderid);

    // Check if payment is already completed
    if (packagePurchase.paymentstatus === "COMPLETED") {
      return res.json({
        success: true,
        message: "Payment already confirmed",
        data: {
          userPackageId: packagePurchase.id,
          orderId: packagePurchase.orderid,
          paymentStatus: packagePurchase.paymentstatus,
          hitpayReference: packagePurchase.hitpayreference,
          packageName: packagePurchase.Package.name,
          packageType: packagePurchase.Package.packagetype,
          targetRole: packagePurchase.Package.targetrole,
          totalAmount: parseFloat(packagePurchase.totalamount),
          activatedAt: packagePurchase.activatedat,
          expiresAt: packagePurchase.expiresat,
          userInfo: {
            email: packagePurchase.User.email,
            name: `${packagePurchase.User.firstName} ${packagePurchase.User.lastName}`,
            memberType: packagePurchase.User.memberType
          }
        }
      });
    }

    // Update payment status to completed
    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentstatus: "COMPLETED",
        hitpayreference: hitpayReference || packagePurchase.hitpayreference,
        activatedat: new Date().toISOString(),
        expiresat: new Date(Date.now() + (packagePurchase.Package.validitydays * 24 * 60 * 60 * 1000)).toISOString(),
        updatedat: new Date().toISOString()
      })
      .eq("id", userPackageId);

    if (updateError) {
      console.error("Package purchase update error:", updateError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package purchase"
      });
    }

    // Create UserPass records based on package contents
    await createUserPasses(packagePurchase);

    res.json({
      success: true,
      message: "Package payment confirmed successfully",
      data: {
        userPackageId: packagePurchase.id,
        orderId: packagePurchase.orderid,
        paymentStatus: "COMPLETED",
        hitpayReference: hitpayReference || packagePurchase.hitpayreference,
        packageName: packagePurchase.Package.name,
        packageType: packagePurchase.Package.packagetype,
        targetRole: packagePurchase.Package.targetrole,
        totalAmount: parseFloat(packagePurchase.totalamount),
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (packagePurchase.Package.validitydays * 24 * 60 * 60 * 1000)).toISOString(),
        userInfo: {
          email: packagePurchase.User.email,
          name: `${packagePurchase.User.firstName} ${packagePurchase.User.lastName}`,
          memberType: packagePurchase.User.memberType
        },
        packageContents: packagePurchase.Package.packagecontents
      }
    });

  } catch (err) {
    console.error("Confirm package payment error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to confirm package payment"
    });
  }
};

// 🎯 Manual payment completion (for fixing webhook issues)
exports.manualCompletePayment = async (req, res) => {
  try {
    const { userPackageId, hitpayReference } = req.body;

    if (!userPackageId || !hitpayReference) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId and hitpayReference are required"
      });
    }

    // Get package purchase details
    const { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents,
          validitydays
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

    // Update payment status to completed
    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentstatus: "COMPLETED",
        hitpayreference: hitpayReference,
        activatedat: new Date().toISOString(),
        expiresat: new Date(Date.now() + (packagePurchase.Package.validitydays * 24 * 60 * 60 * 1000)).toISOString(),
        updatedat: new Date().toISOString()
      })
      .eq("id", userPackageId);

    if (updateError) {
      console.error("Package purchase update error:", updateError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package purchase"
      });
    }

    // Create UserPass records based on package contents
    await createUserPasses(packagePurchase);

    res.json({
      success: true,
      message: "Payment completed successfully",
      data: {
        userPackageId: userPackageId,
        orderId: packagePurchase.orderid,
        paymentStatus: "COMPLETED",
        hitpayReference: hitpayReference,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (packagePurchase.Package.validitydays * 24 * 60 * 60 * 1000)).toISOString()
      }
    });

  } catch (err) {
    console.error("Manual complete payment error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to complete payment manually"
    });
  }
};

