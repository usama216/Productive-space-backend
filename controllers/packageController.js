const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");
const { sendPackageConfirmation } = require("../utils/email");

exports.getPackages = async (req, res) => {
  try {
    const { data: packages, error } = await supabase
      .from("packages")
      .select(`
        *,
        package_passes (
          pass_type,
          hours,
          count
        )
      `)
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      console.error("Error fetching packages:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch packages"
      });
    }

    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      type: pkg.type,
      price: parseFloat(pkg.price),
      originalPrice: parseFloat(pkg.original_price),
      description: pkg.description,
      bonus: pkg.bonus_description,
      validity: pkg.validity_days,
      outletFee: parseFloat(pkg.outlet_fee),
      passes: pkg.package_passes.map(pass => ({
        type: pass.pass_type,
        hours: pass.hours,
        count: pass.count
      }))
    }));

    res.json({
      success: true,
      packages: formattedPackages
    });

  } catch (err) {
    console.error("getPackages error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch packages"
    });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: package, error } = await supabase
      .from("packages")
      .select(`
        *,
        package_passes (
          pass_type,
          hours,
          count
        )
      `)
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error || !package) {
      return res.status(404).json({
        error: "Package not found",
        message: "The requested package does not exist or is inactive"
      });
    }

    const formattedPackage = {
      id: package.id,
      name: package.name,
      type: package.type,
      price: parseFloat(package.price),
      originalPrice: parseFloat(package.original_price),
      description: package.description,
      bonus: package.bonus_description,
      validity: package.validity_days,
      outletFee: parseFloat(package.outlet_fee),
      passes: package.package_passes.map(pass => ({
        type: pass.pass_type,
        hours: pass.hours,
        count: pass.count
      }))
    };

    res.json({
      success: true,
      package: formattedPackage
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch package"
    });
  }
};

exports.purchasePackage = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      quantity = 1,
      customerInfo
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

    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

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
        payment_status: "pending",
        customer_info: customerInfo,
        created_at: new Date().toISOString()
      }]);

    if (historyError) {
      console.error("Error creating purchase history:", historyError);
    }

    res.status(201).json({
      success: true,
      message: "Package purchase record created successfully.",
      data: {
        orderId,
        userPackageId: userPackage.id,
        packageName: package.name,
        quantity,
        totalAmount,
        paymentStatus: "pending"
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to process package purchase"
    });
  }
};

exports.createPackagePaymentRequest = async (req, res) => {
  try {
         const {
       userPackageId,
       orderId,
       amount,
       paymentMethod = "paynow_online",
       customerInfo,
       redirectUrl,
       webhookUrl
     } = req.body;

     if (!userPackageId || !orderId || !amount || !customerInfo || !redirectUrl || !webhookUrl) {
       return res.status(400).json({
         error: "Missing required fields",
         message: "userPackageId, orderId, amount, customerInfo, redirectUrl, and webhookUrl are required"
       });
     }

    const { data: userPackage, error: userPackageError } = await supabase
      .from("user_packages")
      .select(`
        *,
        packages (
          name,
          validity_days
        )
      `)
      .eq("id", userPackageId)
      .single();

    if (userPackageError || !userPackage) {
      return res.status(404).json({
        error: "Package purchase not found",
        message: "The specified package purchase does not exist"
      });
    }

    const { data: purchaseHistory, error: historyError } = await supabase
      .from("purchase_history")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (historyError || !purchaseHistory) {
      return res.status(404).json({
        error: "Purchase history not found",
        message: "The specified purchase history does not exist"
      });
    }

    const referenceNumber = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

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
       amount: parseFloat(amount).toFixed(2),
       currency: "SGD",
       email: customerInfo.email,
       name: customerInfo.name,
       purpose: `Package Purchase: ${userPackage.packages.name}`,
       reference_number: referenceNumber,
       order_id: orderId, 
       redirect_url: redirectUrl,
       webhook: webhookUrl,
       payment_methods: [paymentMethod],
       phone: sanitizedPhone,
       send_email: true,
       send_sms: false,
       allow_repeated_payments: false,
       packageId: userPackageId,
       userId: userPackage.user_id
     };

    try {
      const { createPackagePayment } = require('./payment');
      
      const paymentResult = await createPackagePayment({
        body: paymentRequest
      }, res);

      
    } catch (paymentError) {
      console.error("Payment creation error:", paymentError);
      
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Payment gateway error",
          message: "Failed to create payment request",
          details: paymentError.message
        });
      }
    }

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to create package payment"
    });
  }
};

exports.confirmPackagePurchase = async (req, res) => {
  try {
    const { userPackageId, hitpayReference, paymentStatus } = req.body;

    if (!userPackageId || !hitpayReference || !paymentStatus) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId, hitpayReference, and paymentStatus are required"
      });
    }

    const { data: userPackage, error: userPackageError } = await supabase
      .from("user_packages")
      .select(`
        *,
        packages (
          id,
          name,
          validity_days,
          package_passes (
            pass_type,
            hours,
            count
          )
        )
      `)
      .eq("id", userPackageId)
      .single();

    if (userPackageError || !userPackage) {
      return res.status(404).json({
        error: "User package not found",
        message: "The specified user package does not exist"
      });
    }

    const updateData = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };

    if (paymentStatus === "completed") {
      updateData.activated_at = new Date().toISOString();
      
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt.getTime() + (userPackage.packages.validity_days * 24 * 60 * 60 * 1000));
      updateData.expires_at = expiresAt.toISOString();
    }

    const { data: updatedPackage, error: updateError } = await supabase
      .from("user_packages")
      .update(updateData)
      .eq("id", userPackageId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package status"
      });
    }

    if (paymentStatus === "completed") {
      const passesToCreate = [];
      
      userPackage.packages.package_passes.forEach(passConfig => {
        for (let i = 0; i < passConfig.count; i++) {
          passesToCreate.push({
            id: uuidv4(),
            user_package_id: userPackageId,
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
          console.log(`Created ${passesToCreate.length} passes for package ${userPackageId}`);
          
          // Send package confirmation email with PDF
          console.log("📧 Starting package confirmation email process...");
          try {
            // Get user data for email
            console.log("👤 Fetching user data for user ID:", userPackage.user_id);
            const { data: userData, error: userError } = await supabase
              .from("User")
              .select("id, email, firstName, lastName")
              .eq("id", userPackage.user_id)
              .single();

            if (userError || !userData) {
              console.error("❌ Error fetching user data for package email:", userError);
            } else {
              console.log("✅ User data fetched:", {
                id: userData.id,
                email: userData.email,
                name: userData.firstName || userData.lastName || "N/A"
              });

              // Get purchase history for order details
              console.log("📋 Fetching purchase history for order:", hitpayReference);
              const { data: purchaseHistory, error: historyError } = await supabase
                .from("purchase_history")
                .select("*")
                .eq("order_id", hitpayReference)
                .single();

              if (historyError) {
                console.log("⚠️ Purchase history not found, using defaults:", historyError.message);
              } else {
                console.log("✅ Purchase history fetched:", {
                  orderId: purchaseHistory.order_id,
                  totalAmount: purchaseHistory.total_amount
                });
              }

              // Calculate amounts with card fee
              const baseAmount = parseFloat(purchaseHistory?.total_amount) || 0;
              const paymentMethod = "Online Payment"; // Default for old system
              const isCardPayment = paymentMethod.toLowerCase().includes('card');
              const cardFee = isCardPayment ? baseAmount * 0.05 : 0; // 5% card fee
              const finalAmount = baseAmount + cardFee;

              console.log("💰 Payment calculation (old system):", {
                baseAmount: baseAmount,
                paymentMethod: paymentMethod,
                isCardPayment: isCardPayment,
                cardFee: cardFee,
                finalAmount: finalAmount
              });

              // Prepare package data for email
              const packageEmailData = {
                id: userPackageId,
                orderId: hitpayReference,
                packageName: userPackage.packages.name,
                packageType: "Count-based", // Default for old system
                targetRole: "Student", // Default for old system
                passCount: passesToCreate.length,
                hoursAllowed: passesToCreate[0]?.hours || 4,
                validityDays: userPackage.packages.validity_days || 30,
                baseAmount: baseAmount,
                cardFee: cardFee,
                totalAmount: finalAmount,
                paymentMethod: paymentMethod,
                activatedAt: updateData.activated_at,
                expiresAt: updateData.expires_at,
                purchasedAt: purchaseHistory?.created_at || new Date().toISOString()
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
        }
      }
    }

    await supabase
      .from("purchase_history")
      .update({
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq("hitpay_reference", hitpayReference);

    res.json({
      success: true,
      message: "Package purchase confirmed successfully",
      data: {
        userPackageId,
        paymentStatus,
        activatedAt: updatedPackage.activated_at,
        expiresAt: updatedPackage.expires_at
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to confirm package purchase"
    });
  }
};

exports.getUserPackages = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    const { data: userPackages, error } = await supabase
      .from("user_packages")
      .select(`
        *,
        packages (
          id,
          name,
          type,
          description,
          bonus_description
        )
      `)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("purchased_at", { ascending: false });

    if (error) {
      console.error("Error fetching user packages:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch user packages"
      });
    }


    const packagesWithPasses = await Promise.all(
      userPackages.map(async (userPkg) => {
        const { data: passes, error: passesError } = await supabase
          .from("user_passes")
          .select("status")
          .eq("user_package_id", userPkg.id);

        if (passesError) {
          return userPkg;
        }

        const totalPasses = passes.length;
        const activePasses = passes.filter(p => p.status === "active").length;
        const usedPasses = passes.filter(p => p.status === "used").length;
        const expiredPasses = passes.filter(p => p.status === "expired").length;

        return {
          id: userPkg.id,
          packageId: userPkg.package_id,
          packageName: userPkg.packages.name,
          packageType: userPkg.packages.type,
          description: userPkg.packages.description,
          bonusDescription: userPkg.packages.bonus_description,
          totalPasses,
          usedPasses,
          remainingPasses: activePasses,
          expiredPasses,
          purchasedAt: userPkg.purchased_at,
          activatedAt: userPkg.activated_at,
          expiresAt: userPkg.expires_at,
          isExpired: userPkg.expires_at ? new Date() > new Date(userPkg.expires_at) : false,
          totalAmount: parseFloat(userPkg.total_amount),
          paymentStatus: userPkg.payment_status
        };
      })
    );

    res.json({
      success: true,
      activePackages: packagesWithPasses
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch user packages"
    });
  }
};

exports.getUserPasses = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status = "active" } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const { data: allPasses, error: countError } = await supabase
      .from("user_passes")
      .select(`
        id,
        user_packages!inner(
          user_id,
          packages(name, type)
        )
      `)
      .eq("user_packages.user_id", userId)
      .eq("status", status);

    if (countError) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to count user passes"
      });
    }

    const totalCount = allPasses ? allPasses.length : 0;

      const { data: passes, error } = await supabase
      .from("user_passes")
      .select(`
        *,
        user_packages!inner(
          packages(name, type)
        )
      `)
      .eq("user_packages.user_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: true })
      .range(offset, offset + limitNum - 1); 

    if (error) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch user passes"
      });
    }

  
    const formattedPasses = passes.map(pass => ({
      id: pass.id,
      passType: pass.pass_type,
      hours: pass.hours,
      status: pass.status,
      packageName: pass.user_packages.packages.name,
      packageType: pass.user_packages.packages.type,
      createdAt: pass.created_at,
      canUse: pass.status === "active"
    }));

    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: {
        passes: formattedPasses,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null
        }
      },
      message: `Retrieved ${formattedPasses.length} passes (Page ${pageNum} of ${totalPages})`
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch user passes"
    });
  }
};

exports.usePass = async (req, res) => {
  try {
    const {
      userId,
      passId,
      bookingId,
      locationId,
      startTime,
      endTime
    } = req.body;

    if (!userId || !passId || !bookingId || !locationId || !startTime || !endTime) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "All fields are required: userId, passId, bookingId, locationId, startTime, endTime"
      });
    }

    const { data: pass, error: passError } = await supabase
      .from("user_passes")
      .select(`
        *,
        user_packages (
          user_id,
          packages (
            name
          )
        )
      `)
      .eq("id", passId)
      .eq("status", "active")
      .single();

    if (passError || !pass) {
      return res.status(404).json({
        error: "Pass not found or unavailable",
        message: "The specified pass does not exist or is not available for use"
      });
    }

    if (pass.user_packages.user_id !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "This pass does not belong to the specified user"
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const bookingHours = (end - start) / (1000 * 60 * 60);

    if (bookingHours > pass.hours) {
      return res.status(400).json({
        error: "Insufficient pass hours",
        message: `This pass has ${pass.hours} hours, but the booking requires ${bookingHours} hours`
      });
    }

    const { error: updateError } = await supabase
      .from("user_passes")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
        booking_id: bookingId,
        location_id: locationId,
        start_time: startTime,
        end_time: endTime,
        updated_at: new Date().toISOString()
      })
      .eq("id", passId);

    if (updateError) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to use pass"
      });
    }

    res.json({
      success: true,
      message: "Pass used successfully",
      data: {
        passId,
        passType: pass.pass_type,
        hours: pass.hours,
        packageName: pass.user_packages.packages.name,
        bookingId,
        locationId,
        startTime,
        endTime,
        usedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to use pass"
    });
  }
};

exports.getPurchaseHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    const { data: history, error } = await supabase
      .from("purchase_history")
      .select(`
        *,
        packages (
          name,
          type
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch purchase history"
      });
    }

    const formattedHistory = history.map(item => ({
      id: item.id,
      orderId: item.order_id,
      packageName: item.packages.name,
      packageType: item.packages.type,
      amount: parseFloat(item.amount),
      paymentMethod: item.payment_method,
      paymentStatus: item.payment_status,
      hitpayReference: item.hitpay_reference,
      customerInfo: item.customer_info,
      createdAt: item.created_at
    }));

    res.json({
      success: true,
      purchaseHistory: formattedHistory
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch purchase history"
    });
  }
};
