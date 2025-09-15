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
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod,
        updatedAt: new Date().toISOString()
      })
      .eq("id", userPackageId)
      .eq("orderId", orderId);

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
          packageType,
          targetRole,
          passCount
        )
      `)
      .eq("orderId", event.reference_number)
      .single();

    if (findError || !packagePurchase) {
      console.error("Package purchase not found for order:", event.reference_number);
      return res.status(404).send("Package purchase not found");
    }

    // Update payment status based on webhook event
    if (event.status === 'completed') {
      // Calculate if this was a card payment (check if amount includes 5% fee)
      const originalAmount = parseFloat(packagePurchase.totalAmount);
      const paidAmount = parseFloat(event.amount);
      const isCardPayment = paidAmount > originalAmount && Math.abs(paidAmount - (originalAmount * 1.05)) < 0.01;
      
      // Calculate activatedAt and expiresAt
      const activatedAt = new Date().toISOString();
      const validityDays = packagePurchase.Package.validityDays || 30;
      const expiresAt = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString();

      // Update package purchase to completed
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

// 🎯 Helper function to create UserPass records
async function createUserPasses(packagePurchase) {
  try {
    console.log("createUserPasses called with packagePurchase:", JSON.stringify(packagePurchase, null, 2));
    
    // Validate required data
    if (!packagePurchase || !packagePurchase.Package) {
      throw new Error("Package data is missing or incomplete");
    }
    
    if (!packagePurchase.id || !packagePurchase.userId) {
      throw new Error("Package purchase ID or user ID is missing");
    }
    
    const userPasses = [];

    // Create count-based passes using the new schema
    const passCount = packagePurchase.Package.passCount || 0;
    console.log("Pass count from package:", passCount);
    
    if (passCount > 0) {
      // Validate package type
      const packageType = packagePurchase.Package.packageType;
      if (!packageType || !['HALF_DAY', 'FULL_DAY', 'SEMESTER_BUNDLE'].includes(packageType)) {
        throw new Error(`Invalid package type: ${packageType}`);
      }
      
      // Validate validity days
      const validityDays = packagePurchase.Package.validityDays || 30;
      console.log("Package type:", packageType, "Validity days:", validityDays);
      
      // Create a single UserPass record with count-based system
      userPasses.push({
        id: uuidv4(),
        packagePurchaseId: packagePurchase.id,
        userId: packagePurchase.userId,
        passType: packageType, // HALF_DAY, FULL_DAY, or SEMESTER_BUNDLE
        totalCount: passCount, // Total number of passes
        remainingCount: passCount, // Remaining passes
        status: "ACTIVE",
        usedAt: null,
        bookingId: null,
        locationId: null,
        startTime: null,
        endTime: null,
        expiresAt: new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString(), // When this pass expires
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Semester bundle already handled above with count-based system


    // Insert all user passes
    if (userPasses.length > 0) {
      console.log("Attempting to insert user passes:", JSON.stringify(userPasses, null, 2));
      
      const { error: insertError } = await supabase
        .from("UserPass")
        .insert(userPasses);

      if (insertError) {
        console.error("Error creating user passes:", insertError);
        console.error("Insert data was:", JSON.stringify(userPasses, null, 2));
        throw insertError;
      }

      console.log(`Created ${userPasses.length} user passes for package purchase:`, packagePurchase.id);
    } else {
      console.log("No user passes to create for package purchase:", packagePurchase.id);
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

    // If not found by ID, try by order ID
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
      console.log("Package purchase not found. Error:", findError);
      console.log("Searched for userPackageId:", userPackageId, "orderId:", orderId);
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified package purchase does not exist"
      });
    }

    console.log("Found package purchase:", {
      id: packagePurchase.id,
      orderId: packagePurchase.orderId,
      totalAmount: packagePurchase.totalAmount,
      paymentMethod: packagePurchase.paymentMethod,
      paymentStatus: packagePurchase.paymentStatus
    });

    // Check if payment is already completed
    if (packagePurchase.paymentStatus === "COMPLETED") {
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
          totalAmount: parseFloat(packagePurchase.totalAmount),
          paymentMethod: packagePurchase.paymentMethod, // Add payment method
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

    // Calculate activatedAt and expiresAt
    const activatedAt = new Date().toISOString();
    const validityDays = packagePurchase.Package.validityDays || 30;
    const expiresAt = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString();

    // Update payment status to completed with activation dates
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
      console.error("Package purchase update error:", updateError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package purchase"
      });
    }

    // Create UserPass records based on package contents
    try {
      await createUserPasses(packagePurchase);
    } catch (createPassesError) {
      console.error("Error creating user passes on first attempt:", createPassesError);
      
      // Retry once after a short delay (race condition handling)
      try {
        console.log("Retrying user passes creation after 1 second delay...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await createUserPasses(packagePurchase);
        console.log("User passes created successfully on retry");
      } catch (retryError) {
        console.error("Error creating user passes on retry:", retryError);
        // Don't fail the entire payment confirmation if user passes creation fails
        // The payment is still valid, just log the error
      }
    }

    console.log('Package purchase data for response:', {
      id: packagePurchase.id,
      totalAmount: packagePurchase.totalAmount,
      paymentMethod: packagePurchase.paymentMethod
    });

    const responseData = {
      userPackageId: packagePurchase.id,
      orderId: packagePurchase.orderId,
      paymentStatus: "COMPLETED",
      hitpayReference: hitpayReference,
      packageName: packagePurchase.Package.name,
      packageType: packagePurchase.Package.packageType,
      targetRole: packagePurchase.Package.targetRole,
      totalAmount: parseFloat(packagePurchase.totalAmount),
      paymentMethod: packagePurchase.paymentMethod, // Add payment method
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

    console.log('Response data being sent:', {
      paymentMethod: responseData.paymentMethod,
      totalAmount: responseData.totalAmount
    });

    res.json({
      success: true,
      message: "Package payment confirmed successfully",
      data: responseData
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

    // Update payment status to completed
    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentStatus: "COMPLETED",
        updatedAt: new Date().toISOString()
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
        orderId: packagePurchase.orderId,
        paymentStatus: "COMPLETED",
        hitpayReference: hitpayReference,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString()
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

