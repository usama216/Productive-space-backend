const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");

// ==================== CLIENT APIs ====================

// 🎯 Get packages by role (MEMBER, TUTOR, STUDENT)
exports.getPackagesByRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    // Validate role
    if (!['MEMBER', 'TUTOR', 'STUDENT'].includes(role.toUpperCase())) {
      return res.status(400).json({
        error: "Invalid role",
        message: "Role must be MEMBER, TUTOR, or STUDENT"
      });
    }

    const { data: packages, error } = await supabase
      .from("Package")
      .select("*")
      .eq("targetrole", role.toUpperCase())
      .eq("isactive", true)
      .order("packagetype", { ascending: true })
      .order("price", { ascending: true });

    if (error) {
      console.error("Error fetching packages by role:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch packages"
      });
    }

    // Format packages for frontend
    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      packageType: pkg.packagetype,
      targetRole: pkg.targetrole,
      price: parseFloat(pkg.price),
      originalPrice: parseFloat(pkg.originalprice),
      outletFee: parseFloat(pkg.outletfee),
      packageContents: pkg.packagecontents,
      validityDays: pkg.validitydays,
      discount: pkg.originalprice ? Math.round(((pkg.originalprice - pkg.price) / pkg.originalprice) * 100) : 0
    }));

    res.json({
      success: true,
      role: role.toUpperCase(),
      packages: formattedPackages,
      totalPackages: formattedPackages.length
    });

  } catch (err) {
    console.error("getPackagesByRole error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch packages"
    });
  }
};

// 🎯 Get specific package by ID
exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: package, error } = await supabase
      .from("Package")
      .select("*")
      .eq("id", id)
      .eq("isactive", true)
      .single();

    if (error || !package) {
      return res.status(404).json({
        error: "Package not found",
        message: "The requested package does not exist or is inactive"
      });
    }

    // Format package for frontend
    const formattedPackage = {
      id: package.id,
      name: package.name,
      description: package.description,
      packageType: package.packagetype,
      targetRole: package.targetrole,
      price: parseFloat(package.price),
      originalPrice: parseFloat(package.originalprice),
      outletFee: parseFloat(package.outletfee),
      packageContents: package.packagecontents,
      validityDays: package.validitydays,
      discount: package.originalprice ? Math.round(((package.originalprice - package.price) / package.originalprice) * 100) : 0
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

// 🎯 Purchase package (create purchase record)
exports.purchasePackage = async (req, res) => {
  try {
    const {
      userId,
      packageId,
      quantity = 1,
      customerInfo
    } = req.body;

    // Validate required fields
    if (!userId || !packageId || !customerInfo) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userId, packageId, and customerInfo are required"
      });
    }

    // Check if package exists and is active
    const { data: package, error: packageError } = await supabase
      .from("Package")
      .select("*")
      .eq("id", packageId)
      .eq("isactive", true)
      .single();

    if (packageError || !package) {
      return res.status(404).json({
        error: "Package not found",
        message: "The requested package does not exist or is inactive"
      });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("User")
      .select("id, email, firstName, lastName, memberType")
      .eq("id", userId)
      .single();
      
    if (userError || !user) {
      return res.status(404).json({
        error: "User not found",
        message: "The specified user does not exist"
      });
    }

    // Calculate total amount
    const baseAmount = parseFloat(package.price) * quantity;
    const outletFee = parseFloat(package.outletfee) * quantity;
    const totalAmount = baseAmount + outletFee;

    // Generate order ID
    const orderId = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create package purchase record
    const { data: packagePurchase, error: purchaseError } = await supabase
      .from("PackagePurchase")
      .insert([{
        id: uuidv4(),
        userid: userId,
        packageid: packageId,
        quantity: quantity,
        totalamount: totalAmount,
        paymentstatus: "PENDING",
        customerinfo: customerInfo,
        orderid: orderId,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      }])
      .select()
      .single();

    if (purchaseError) {
      console.error("Error creating package purchase:", purchaseError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to create package purchase record"
      });
    }

    res.status(201).json({
      success: true,
      message: "Package purchase record created successfully",
      data: {
        purchaseId: packagePurchase.id,
        orderId: orderId,
        packageName: package.name,
        packageType: package.packagetype,
        targetRole: package.targetrole,
        quantity: quantity,
        totalAmount: totalAmount,
        paymentStatus: "PENDING"
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

// 🎯 Get user's package purchases
exports.getUserPackages = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    // Get user's package purchases with package details
    const { data: purchases, error } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          description,
          packagetype,
          targetrole,
          packagecontents
        )
      `)
      .eq("userid", userId)
      .eq("isactive", true)
      .order("createdat", { ascending: false });

    if (error) {
      console.error("Error fetching user packages:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch user packages"
      });
    }

    // Get pass counts for each purchase
    const purchasesWithPasses = await Promise.all(
      purchases.map(async (purchase) => {
        const { data: passes, error: passesError } = await supabase
          .from("UserPass")
          .select("status")
          .eq("packagepurchaseid", purchase.id);

        if (passesError) {
          console.error("Error fetching passes:", passesError);
          return purchase;
        }

        const totalPasses = passes.length;
        const activePasses = passes.filter(p => p.status === "ACTIVE").length;
        const usedPasses = passes.filter(p => p.status === "USED").length;
        const expiredPasses = passes.filter(p => p.status === "EXPIRED").length;

        return {
          id: purchase.id,
          orderId: purchase.orderid,
          packageId: purchase.packageid,
          packageName: purchase.Package.name,
          packageType: purchase.Package.packagetype,
          targetRole: purchase.Package.targetrole,
          description: purchase.Package.description,
          packageContents: purchase.Package.packagecontents,
          quantity: purchase.quantity,
          totalAmount: parseFloat(purchase.totalamount),
          paymentStatus: purchase.paymentstatus,
          paymentMethod: purchase.paymentmethod,
          activatedAt: purchase.activatedat,
          expiresAt: purchase.expiresat,
          isExpired: purchase.expiresat ? new Date() > new Date(purchase.expiresat) : false,
          totalPasses,
          usedPasses,
          remainingPasses: activePasses,
          expiredPasses,
          createdAt: purchase.createdat
        };
      })
    );

    res.json({
      success: true,
      purchases: purchasesWithPasses,
      totalPurchases: purchasesWithPasses.length
    });

  } catch (err) {
    console.error("getUserPackages error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch user packages"
    });
  }
};

// ==================== ADMIN APIs ====================

// 🎯 Get all packages (admin)
exports.getAllPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, packageType, isActive } = req.query;

    // Build query
    let query = supabase
      .from("Package")
      .select("*", { count: 'exact' });

    // Apply filters
    if (role) query = query.eq("targetrole", role.toUpperCase());
    if (packageType) query = query.eq("packagetype", packageType.toUpperCase());
    if (isActive !== undefined) query = query.eq("isactive", isActive === 'true');

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    query = query
      .order("createdat", { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: packages, error, count } = await query;

    if (error) {
      console.error("Error fetching all packages:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch packages"
      });
    }

    // Format packages
    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      packageType: pkg.packagetype,
      targetRole: pkg.targetrole,
      price: parseFloat(pkg.price),
      originalPrice: parseFloat(pkg.originalprice),
      outletFee: parseFloat(pkg.outletfee),
      packageContents: pkg.packagecontents,
      validityDays: pkg.validitydays,
      isActive: pkg.isactive,
      discount: pkg.originalprice ? Math.round(((pkg.originalprice - pkg.price) / pkg.originalprice) * 100) : 0,
      createdAt: pkg.createdat,
      updatedAt: pkg.updatedat
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(count / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: {
        packages: formattedPackages,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: count,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null
        }
      }
    });

  } catch (err) {
    console.error("getAllPackages error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch packages"
    });
  }
};

// 🎯 Create new package (admin)
exports.createPackage = async (req, res) => {
  try {
    const {
      name,
      description,
      packageType,
      targetRole,
      price,
      originalPrice,
      outletFee = 5.00,
      packageContents,
      validityDays = 30
    } = req.body;

    // Validate required fields
    if (!name || !packageType || !targetRole || !price || !packageContents) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name, packageType, targetRole, price, and packageContents are required"
      });
    }

    // Validate enum values
    if (!['HALF_DAY', 'FULL_DAY', 'SEMESTER_BUNDLE'].includes(packageType)) {
      return res.status(400).json({
        error: "Invalid packageType",
        message: "packageType must be HALF_DAY, FULL_DAY, or SEMESTER_BUNDLE"
      });
    }

    if (!['MEMBER', 'TUTOR', 'STUDENT'].includes(targetRole)) {
      return res.status(400).json({
        error: "Invalid targetRole",
        message: "targetRole must be MEMBER, TUTOR, or STUDENT"
      });
    }

    // Create package
    const { data: newPackage, error } = await supabase
      .from("Package")
      .insert([{
        id: uuidv4(),
        name: name,
        description: description,
        packagetype: packageType,
        targetrole: targetRole,
        price: parseFloat(price),
        originalprice: originalPrice ? parseFloat(originalPrice) : null,
        outletfee: parseFloat(outletFee),
        packagecontents: packageContents,
        validitydays: parseInt(validityDays),
        isactive: true,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error("Error creating package:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to create package"
      });
    }

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      package: {
        id: newPackage.id,
        name: newPackage.name,
        description: newPackage.description,
        packageType: newPackage.packagetype,
        targetRole: newPackage.targetrole,
        price: parseFloat(newPackage.price),
        originalPrice: parseFloat(newPackage.originalprice),
        outletFee: parseFloat(newPackage.outletfee),
        packageContents: newPackage.packagecontents,
        validityDays: newPackage.validitydays,
        isActive: newPackage.isactive,
        createdAt: newPackage.createdat
      }
    });

  } catch (err) {
    console.error("createPackage error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to create package"
    });
  }
};

// 🎯 Update package (admin)
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdat;

    // Add updatedAt
    updateData.updatedat = new Date().toISOString();

    // Update package
    const { data: updatedPackage, error } = await supabase
      .from("Package")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating package:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update package"
      });
    }

    if (!updatedPackage) {
      return res.status(404).json({
        error: "Package not found",
        message: "The specified package does not exist"
      });
    }

    res.json({
      success: true,
      message: "Package updated successfully",
      package: {
        id: updatedPackage.id,
        name: updatedPackage.name,
        description: updatedPackage.description,
        packageType: updatedPackage.packagetype,
        targetRole: updatedPackage.targetrole,
        price: parseFloat(updatedPackage.price),
        originalPrice: parseFloat(updatedPackage.originalprice),
        outletFee: parseFloat(updatedPackage.outletfee),
        packageContents: updatedPackage.packagecontents,
        validityDays: updatedPackage.validitydays,
        isActive: updatedPackage.isactive,
        updatedAt: updatedPackage.updatedat
      }
    });

  } catch (err) {
    console.error("updatePackage error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to update package"
    });
  }
};

// 🎯 Delete package (admin)
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if package has any purchases
    const { data: purchases, error: checkError } = await supabase
      .from("PackagePurchase")
      .select("id")
      .eq("packageid", id)
      .limit(1);

    if (checkError) {
      console.error("Error checking package purchases:", checkError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to check package usage"
      });
    }

    if (purchases && purchases.length > 0) {
      return res.status(400).json({
        error: "Cannot delete package",
        message: "This package has existing purchases. Deactivate it instead."
      });
    }

    // Delete package
    const { error } = await supabase
      .from("Package")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting package:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to delete package"
      });
    }

    res.json({
      success: true,
      message: "Package deleted successfully"
    });

  } catch (err) {
    console.error("deletePackage error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to delete package"
    });
  }
};

// 🎯 Get all package purchases (admin)
exports.getAllPackagePurchases = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId, packageId, paymentStatus, role } = req.query;

    // Build query
    let query = supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole
        ),
        User (
          id,
          email,
          firstName,
          lastName,
          memberType
        )
      `, { count: 'exact' });

    // Apply filters
    if (userId) query = query.eq("userid", userId);
    if (packageId) query = query.eq("packageid", packageId);
    if (paymentStatus) query = query.eq("paymentstatus", paymentStatus.toUpperCase());
    if (role) query = query.eq("Package.targetrole", role.toUpperCase());

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    query = query
      .order("createdat", { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: purchases, error, count } = await query;

    if (error) {
      console.error("Error fetching package purchases:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch package purchases"
      });
    }

    // Format purchases
    const formattedPurchases = purchases.map(purchase => ({
      id: purchase.id,
      orderId: purchase.orderid,
      userId: purchase.userid,
      userEmail: purchase.User.email,
      userName: `${purchase.User.firstName} ${purchase.User.lastName}`,
      userMemberType: purchase.User.memberType,
      packageId: purchase.packageid,
      packageName: purchase.Package.name,
      packageType: purchase.Package.packagetype,
      targetRole: purchase.Package.targetrole,
      quantity: purchase.quantity,
      totalAmount: parseFloat(purchase.totalamount),
      paymentStatus: purchase.paymentstatus,
      paymentMethod: purchase.paymentmethod,
      hitpayReference: purchase.hitpayreference,
      isActive: purchase.isactive,
      activatedAt: purchase.activatedat,
      expiresAt: purchase.expiresat,
      customerInfo: purchase.customerinfo,
      createdAt: purchase.createdat
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(count / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: {
        purchases: formattedPurchases,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: count,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          prevPage: hasPrevPage ? pageNum - 1 : null
        }
      }
    });

  } catch (err) {
    console.error("getAllPackagePurchases error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch package purchases"
    });
  }
};
