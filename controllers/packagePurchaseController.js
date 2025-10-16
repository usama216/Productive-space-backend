const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");
const axios = require("axios");
const { sendPackageConfirmation } = require("../utils/email");

const hitpayClient = axios.create({
  baseURL: process.env.HITPAY_API_URL,
  headers: {
    "X-BUSINESS-API-KEY": process.env.HITPAY_API_KEY,
    "Content-Type": "application/json" 
  }
});

exports.initiatePackagePurchase = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      quantity = 1,
      customerInfo,
      paymentMethod = "paynow_online"
    } = req.body;

    if (!userId || !packageId || !customerInfo) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userId, packageId, and customerInfo are required"
      });
    }

    const { data: package, error: packageError } = await supabase
      .from("packages")
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .single();

    if (packageError || !package) {
      return res.status(404).json({
        error: "Package not found",
        message: "The requested package does not exist or is inactive"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("User")
      .select("id, email, firstName, lastName")
      .eq("id", userId)
      .single();
      
    if (userError || !user) {
      return res.status(404).json({
        error: "User not found",
        message: "The specified user does not exist in the User table"
      });
    }

  
    const baseAmount = parseFloat(package.price) * quantity;
    const outletFee = parseFloat(package.outlet_fee) * quantity;
    const totalAmount = baseAmount + outletFee;

    const orderId = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const referenceNumber = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const { data: userPackage, error: userPackageError } = await supabase
      .from("user_packages")
      .insert([{
        id: uuidv4(),
        user_id: userId,
        package_id: packageId,
        quantity,
        total_amount: totalAmount,
        payment_status: "pending",
        customer_info: customerInfo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userPackageError) {
      console.error("Error creating user package:", userPackageError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to create package purchase record"
      });
    }

    const { error: historyError } = await supabase
      .from("purchase_history")
      .insert([{
        id: uuidv4(),
        user_id: userId,
        package_id: packageId,
        order_id: orderId,
        amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: "pending",
        customer_info: customerInfo,
        created_at: new Date().toISOString()
      }]);

    if (historyError) {
      console.error("Error creating purchase history:", historyError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to create purchase history"
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://testmps.com';
    const backendUrl = process.env.BACKEND_URL || 'https://testmps.com';
    
    // Sanitize phone number: remove all non-numeric characters except leading +
    // and limit to 15 characters to comply with HitPay API requirements
    let sanitizedPhone = "";
    if (customerInfo.phone) {
      sanitizedPhone = customerInfo.phone.replace(/[\s\(\)\-]/g, '');
      if (sanitizedPhone.length > 15) {
        sanitizedPhone = sanitizedPhone.substring(0, 15);
      }
    }
    
    const paymentRequest = {
      amount: totalAmount.toFixed(2),
      currency: "SGD",
      email: customerInfo.email,
      name: customerInfo.name,
      purpose: `Package Purchase: ${package.name}`,
      reference_number: referenceNumber,
      redirect_url: `${frontendUrl}/payment/success?orderId=${orderId}`,
      webhook: `${backendUrl}/api/packages/webhook`,
      payment_methods: [paymentMethod],
      phone: sanitizedPhone,
      send_email: true,
      send_sms: false,
      allow_repeated_payments: false,
      packageId: userPackage.id,
      userId: userId
    };

    try {
      const { createPackagePayment } = require('./payment');
      
      const paymentResult = await createPackagePayment({
        body: paymentRequest
      }, {
        status: (code) => ({
          json: (data) => {
            if (code === 200) {
              supabase
                .from("purchase_history")
                .update({
                  hitpay_reference: referenceNumber,
                  updated_at: new Date().toISOString()
                })
                .eq("order_id", orderId);

              res.status(201).json({
                success: true,
                message: "Package purchase initiated successfully",
                data: {
                  orderId,
                  userPackageId: userPackage.id,
                  packageName: package.name,
                  quantity,
                  totalAmount,
                  paymentStatus: "pending",
                  hitpayPaymentUrl: data.url,
                  referenceNumber,
                  paymentId: data.id
                }
              });
            } else {
              res.status(500).json({
                error: "Payment gateway error",
                message: "Failed to create payment request",
                details: data
              });
            }
          }
        })
      });

    } catch (paymentError) {
      
      await supabase
        .from("purchase_history")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString()
        })
        .eq("order_id", orderId);

      return res.status(500).json({
        error: "Payment gateway error",
        message: "Failed to create payment request",
        details: paymentError.message
      });
    }

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to initiate package purchase"
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

    const { data: purchase, error: purchaseError } = await supabase
      .from("purchase_history")
      .select(`
        *,
        user_packages (
          id,
          user_id,
          package_id,
          packages (
            name,
            validity_days,
            package_passes (
              pass_type,
              hours,
              count
            )
          )
        )
      `)
      .eq("hitpay_reference", event.reference_number)
      .single();

    if (purchaseError || !purchase) {
      console.error("Purchase record not found for reference:", event.reference_number);
      return res.status(404).json({ error: "Purchase record not found" });
    }

    const { error: updateError } = await supabase
      .from("purchase_history")
      .update({
        payment_status: event.status,
        updated_at: new Date().toISOString()
      })
      .eq("hitpay_reference", event.reference_number);

    if (updateError) {
      console.error("Error updating purchase history:", updateError);
    }

    if (event.status === "completed") {
      const userPackage = purchase.user_packages;
      
      const updateData = {
        payment_status: "completed",
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (userPackage.packages.validity_days) {
        const activatedAt = new Date();
        const expiresAt = new Date(activatedAt.getTime() + (userPackage.packages.validity_days * 24 * 60 * 60 * 1000));
        updateData.expires_at = expiresAt.toISOString();
      }

      const { error: userPackageError } = await supabase
        .from("user_packages")
        .update(updateData)
        .eq("id", userPackage.id);

      if (userPackageError) {
        console.error("Error updating user package:", userPackageError);
      } else {
        const passesToCreate = [];
        
        userPackage.packages.package_passes.forEach(passConfig => {
          for (let i = 0; i < passConfig.count; i++) {
            passesToCreate.push({
              id: uuidv4(),
              user_package_id: userPackage.id,
              pass_type: passConfig.pass_type,
              hours: passConfig.hours,
              status: "active",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        });

        if (passesToCreate.length > 0) {
          const { error: passesError } = await supabase
            .from("user_passes")
            .insert(passesToCreate);

          if (passesError) {
            console.error("Error creating passes:", passesError);
          } else {
            console.log(`Created ${passesToCreate.length} passes for package ${userPackage.id}`);
            
            // Send package confirmation email with PDF
            try {
              // Get user data for email
              const { data: userData, error: userError } = await supabase
                .from("User")
                .select("id, email, firstName, lastName, name")
                .eq("id", userPackage.user_id)
                .single();

              if (userError || !userData) {
                console.error("Error fetching user data for package email:", userError);
              } else {
                // Prepare package data for email
                const packageEmailData = {
                  id: userPackage.id,
                  orderId: purchase.order_id,
                  packageName: userPackage.packages.name,
                  packageType: "Count-based", // Default for old system
                  targetRole: "Student", // Default for old system
                  passCount: passesToCreate.length,
                  hoursAllowed: passesToCreate[0]?.hours || 4,
                  validityDays: userPackage.packages.validity_days || 30,
                  totalAmount: purchase.total_amount,
                  paymentMethod: "Online Payment",
                  activatedAt: updateData.activated_at,
                  expiresAt: updateData.expires_at,
                  purchasedAt: purchase.created_at
                };

                const emailResult = await sendPackageConfirmation(userData, packageEmailData);
                
                if (emailResult.success) {
                  console.log("Package confirmation email sent successfully:", emailResult.messageId);
                } else {
                  console.error("Error sending package confirmation email:", emailResult.error);
                }
              }
            } catch (emailError) {
              console.error("Error sending package confirmation email:", emailError);
            }
          }
        }
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Package webhook handler error:", err.message);
    res.status(500).send("Internal Server Error");
  }
};

exports.getPurchaseStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        error: "Missing order ID",
        message: "Order ID is required"
      });
    }

    const { data: purchase, error } = await supabase
      .from("purchase_history")
      .select(`
        *,
        packages (
          name,
          type
        ),
        user_packages (
          id,
          payment_status,
          activated_at,
          expires_at
        )
      `)
      .eq("order_id", orderId)
      .single();

    if (error || !purchase) {
      return res.status(404).json({
        error: "Purchase not found",
        message: "The specified purchase does not exist"
      });
    }

    let passCount = 0;
    if (purchase.user_packages && purchase.user_packages.payment_status === "completed") {
      const { data: passes, error: passesError } = await supabase
        .from("user_passes")
        .select("id")
        .eq("user_package_id", purchase.user_packages.id);

      if (!passesError) {
        passCount = passes.length;
      }
    }

    res.json({
      success: true,
      purchase: {
        orderId: purchase.order_id,
        packageName: purchase.packages.name,
        packageType: purchase.packages.type,
        amount: parseFloat(purchase.amount),
        paymentMethod: purchase.payment_method,
        paymentStatus: purchase.payment_status,
        customerInfo: purchase.customer_info,
        createdAt: purchase.created_at,
        activatedAt: purchase.user_packages?.activated_at,
        expiresAt: purchase.user_packages?.expires_at,
        totalPasses: passCount
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch purchase status"
    });
  }
};

