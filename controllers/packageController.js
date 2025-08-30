const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");

// 🎯 Get all available packages
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

    // Format packages with passes
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

// 🎯 Get package by ID
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

    // Format package with passes
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
    console.error("getPackageById error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch package"
    });
  }
};

// 🎯 Create package purchase record (NO payment yet)
exports.purchasePackage = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      quantity = 1,
      customerInfo
    } = req.body;

    // Validate required fields (NO paymentInfo required)
    if (!userId || !packageId || !customerInfo) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userId, packageId, and customerInfo are required"
      });
    }

    // Check if package exists and is active
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

    // Check if user exists in User table
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

    // Calculate total amount
    const baseAmount = parseFloat(package.price) * quantity;
    const outletFee = parseFloat(package.outlet_fee) * quantity;
    const totalAmount = baseAmount + outletFee;

    // Generate order ID
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create user package record (NO payment info yet)
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

    // Create purchase history record (NO payment info yet)
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
      // Don't fail the request, just log the error
    }

    // Return success - frontend will now call /api/packages/payment to create payment
    res.status(201).json({
      success: true,
      message: "Package purchase record created successfully. Call /api/packages/payment to create payment.",
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
    console.error("purchasePackage error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to process package purchase"
    });
  }
};

// 🎯 Create payment for package (same as booking system)
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

         // Validate required fields
     if (!userPackageId || !orderId || !amount || !customerInfo || !redirectUrl || !webhookUrl) {
       return res.status(400).json({
         error: "Missing required fields",
         message: "userPackageId, orderId, amount, customerInfo, redirectUrl, and webhookUrl are required"
       });
     }

    // Check if package purchase exists
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

    // Check if purchase history exists
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

    // Generate reference number for HitPay
    const referenceNumber = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

         // Use frontend-provided URLs (no environment variables needed)
     const paymentRequest = {
       amount: parseFloat(amount).toFixed(2),
       currency: "SGD",
       email: customerInfo.email,
       name: customerInfo.name,
       purpose: `Package Purchase: ${userPackage.packages.name}`,
       reference_number: referenceNumber,
       order_id: orderId, // Add this for payment controller
       redirect_url: redirectUrl,
       webhook: webhookUrl,
       payment_methods: [paymentMethod],
       phone: customerInfo.phone,
       send_email: true,
       send_sms: false,
       allow_repeated_payments: false,
       packageId: userPackageId,
       userId: userPackage.user_id
     };

    try {
      // Use your existing working payment system - call createPackagePayment from payment controller
      const { createPackagePayment } = require('./payment');
      
      // Create the payment using your existing function
      const paymentResult = await createPackagePayment({
        body: paymentRequest
      }, res);

      // If we reach here, the payment was created successfully
      // The createPackagePayment function already sends the response
      // So we don't need to do anything else here
      
    } catch (paymentError) {
      console.error("Payment creation error:", paymentError);
      
      // Only send error response if it hasn't been sent yet
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Payment gateway error",
          message: "Failed to create payment request",
          details: paymentError.message
        });
      }
    }

  } catch (err) {
    console.error("createPackagePaymentRequest error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to create package payment"
    });
  }
};

// 🎯 Confirm package purchase after payment
exports.confirmPackagePurchase = async (req, res) => {
  try {
    const { userPackageId, hitpayReference, paymentStatus } = req.body;

    if (!userPackageId || !hitpayReference || !paymentStatus) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userPackageId, hitpayReference, and paymentStatus are required"
      });
    }

    // Get user package details
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

    // Update payment status
    const updateData = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };

    // If payment is completed, activate the package and create passes
    if (paymentStatus === "completed") {
      updateData.activated_at = new Date().toISOString();
      
      // Calculate expiration date
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt.getTime() + (userPackage.packages.validity_days * 24 * 60 * 60 * 1000));
      updateData.expires_at = expiresAt.toISOString();
    }

    // Update user package
    const { data: updatedPackage, error: updateError } = await supabase
      .from("user_packages")
      .update(updateData)
      .eq("id", userPackageId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user package:", updateError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package status"
      });
    }

    // If payment completed, create individual passes
    if (paymentStatus === "completed") {
      const passesToCreate = [];
      
      // Create passes based on package configuration
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

      // Insert all passes
      if (passesToCreate.length > 0) {
        const { error: passesError } = await supabase
          .from("user_passes")
          .insert(passesToCreate);

        if (passesError) {
          console.error("Error creating passes:", passesError);
          // Don't fail the request, just log the error
        }
      }
    }

    // Update purchase history
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
    console.error("confirmPackagePurchase error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to confirm package purchase"
    });
  }
};

// 🎯 Get user's active packages
exports.getUserPackages = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    // Get user packages with package details
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

    // Get pass counts for each package
    const packagesWithPasses = await Promise.all(
      userPackages.map(async (userPkg) => {
        const { data: passes, error: passesError } = await supabase
          .from("user_passes")
          .select("status")
          .eq("user_package_id", userPkg.id);

        if (passesError) {
          console.error("Error fetching passes:", passesError);
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
    console.error("getUserPackages error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch user packages"
    });
  }
};

// 🎯 Get user's available passes with pagination
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

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    console.log(`🔍 Pagination: page=${pageNum}, limit=${limitNum}, offset=${offset}`);

    // Get total count first - use a proper join query
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
      console.error("Error counting user passes:", countError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to count user passes"
      });
    }

    const totalCount = allPasses ? allPasses.length : 0;

    console.log(`📊 Total count: ${totalCount}`);

    // Get paginated passes - THIS IS THE KEY PART!
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
      .range(offset, offset + limitNum - 1); // THIS LIMITS THE RESULTS!

    if (error) {
      console.error("Error fetching user passes:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch user passes"
      });
    }

    console.log(`✅ Retrieved ${passes.length} passes (should be ${limitNum})`);

    // Format passes
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

    // Calculate pagination info
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
    console.error("getUserPasses error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch user passes"
    });
  }
};

// 🎯 Use a pass for booking
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

    // Check if pass exists and is available
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

    // Verify pass belongs to user
    if (pass.user_packages.user_id !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "This pass does not belong to the specified user"
      });
    }

    // Check if pass has enough hours for the booking
    const start = new Date(startTime);
    const end = new Date(endTime);
    const bookingHours = (end - start) / (1000 * 60 * 60);

    if (bookingHours > pass.hours) {
      return res.status(400).json({
        error: "Insufficient pass hours",
        message: `This pass has ${pass.hours} hours, but the booking requires ${bookingHours} hours`
      });
    }

    // Update pass status to used
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
      console.error("Error updating pass:", updateError);
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
    console.error("usePass error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to use pass"
    });
  }
};

// 🎯 Get purchase history for user
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
      console.error("Error fetching purchase history:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch purchase history"
      });
    }

    // Format history
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
    console.error("getPurchaseHistory error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch purchase history"
    });
  }
};
