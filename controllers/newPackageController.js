const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");
const { getUserPackageUsage } = require("../utils/packageUsageHelper");

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
      .eq("targetRole", role.toUpperCase())
      .eq("isActive", true)
      .order("packageType", { ascending: true })
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
      packageType: pkg.packageType,
      targetRole: pkg.targetRole,
      price: parseFloat(pkg.price),
      originalPrice: parseFloat(pkg.originalPrice),
      outletFee: parseFloat(pkg.outletFee),
      passCount: pkg.passCount,
      validityDays: pkg.validityDays,
      discount: pkg.originalPrice ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0
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
      .eq("isActive", true)
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
      packageType: package.packageType,
      targetRole: package.targetRole,
      price: parseFloat(package.price),
      originalPrice: parseFloat(package.originalPrice),
      outletFee: parseFloat(package.outletFee),
      passCount: package.passCount,
      validityDays: package.validityDays,
      discount: package.originalPrice ? Math.round(((package.originalPrice - package.price) / package.originalPrice) * 100) : 0
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
      customerInfo,
      totalAmount, // Optional: if provided, use this instead of calculating
      paymentMethod // Optional: payment method used
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
      .eq("isActive", true)
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
    const outletFee = parseFloat(package.outletFee) * quantity;
    const calculatedTotalAmount = baseAmount + outletFee;
    
    // Use provided totalAmount if available (includes card fees), otherwise use calculated amount
    const finalTotalAmount = totalAmount ? parseFloat(totalAmount) : calculatedTotalAmount;
    
    console.log('Package purchase amount calculation:', {
      baseAmount,
      outletFee,
      calculatedTotalAmount,
      providedTotalAmount: totalAmount,
      finalTotalAmount
    });

    // Generate order ID
    const orderId = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create package purchase record
    const { data: packagePurchase, error: purchaseError } = await supabase
      .from("PackagePurchase")
      .insert([{
        id: uuidv4(),
        userId: userId,
        packageId: packageId,
        quantity: quantity,
        totalAmount: finalTotalAmount,
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod, // Store payment method
        customerInfo: customerInfo,
        orderId: orderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        packageType: package.packageType,
        targetRole: package.targetRole,
        quantity: quantity,
        totalAmount: finalTotalAmount,
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
          packageType,
          targetRole,
          passCount,
          validityDays
        )
      `)
      .eq("userId", userId)
      .eq("isActive", true)
      .order("createdAt", { ascending: false });

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
          .select("status, totalCount, remainingCount")
          .eq("packagepurchaseid", purchase.id);

        if (passesError) {
          console.error("Error fetching passes:", passesError);
          return purchase;
        }

        // Count-based system: use totalCount and remainingCount
        const totalPasses = passes.reduce((sum, pass) => sum + (pass.totalCount || 0), 0);
        const activePasses = passes.filter(p => p.status === "ACTIVE").reduce((sum, pass) => sum + (pass.remainingCount || 0), 0);
        const usedPasses = passes.reduce((sum, pass) => sum + ((pass.totalCount || 0) - (pass.remainingCount || 0)), 0);
        const expiredPasses = passes.filter(p => p.status === "EXPIRED").reduce((sum, pass) => sum + (pass.totalCount || 0), 0);

        // Calculate activatedAt and expiresAt for completed packages
        let activatedAt = purchase.activatedAt;
        let expiresAt = purchase.expiresAt;
        
        if (purchase.paymentStatus === 'COMPLETED' && !activatedAt) {
          // If package is completed but no activatedAt, set it to createdAt
          activatedAt = purchase.createdAt;
        }
        
        if (purchase.paymentStatus === 'COMPLETED' && !expiresAt) {
          // If package is completed but no expiresAt, calculate it
          const validityDays = purchase.Package.validityDays || 30;
          const activatedDate = activatedAt ? new Date(activatedAt) : new Date(purchase.createdAt);
          expiresAt = new Date(activatedDate.getTime() + (validityDays * 24 * 60 * 60 * 1000)).toISOString();
        }

        return {
          id: purchase.id,
          orderId: purchase.orderId,
          packageId: purchase.packageId,
          packageName: purchase.Package.name,
          packageType: purchase.Package.packageType,
          targetRole: purchase.Package.targetRole,
          description: purchase.Package.description,
          passCount: purchase.Package.passCount,
          validityDays: purchase.Package.validityDays,
          quantity: purchase.quantity,
          totalAmount: parseFloat(purchase.totalAmount),
          paymentStatus: purchase.paymentStatus,
          paymentMethod: purchase.paymentMethod,
          activatedAt: activatedAt,
          expiresAt: expiresAt,
          isExpired: expiresAt ? new Date() > new Date(expiresAt) : false,
          totalPasses: totalPasses,
          usedPasses: usedPasses,
          remainingPasses: activePasses,
          expiredPasses: expiredPasses,
          createdAt: purchase.createdAt
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
    if (role) query = query.eq("targetRole", role.toUpperCase());
    if (packageType) query = query.eq("packageType", packageType.toUpperCase());
    if (isActive !== undefined) query = query.eq("isActive", isActive === 'true');

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    query = query
      .order("createdAt", { ascending: false })
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
      packageType: pkg.packageType,
      targetRole: pkg.targetRole,
      price: parseFloat(pkg.price),
      originalPrice: parseFloat(pkg.originalPrice),
      outletFee: parseFloat(pkg.outletFee),
      passCount: pkg.passCount,
      validityDays: pkg.validityDays,
      isActive: pkg.isActive,
      discount: pkg.originalPrice ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt
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
    if (!name || !packageType || !targetRole || !price) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name, packageType, targetRole, and price are required"
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

    // Prepare package data
    const packageData = {
      id: uuidv4(),
      name: name,
      description: description,
      packageType: packageType,
      targetRole: targetRole,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      outletFee: parseFloat(outletFee),
      passCount: parseInt(packageContents?.passCount || 1),
      validityDays: parseInt(validityDays),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };


    console.log("Creating package with data:", packageData);

    // Create package with correct field names
    const { data: newPackage, error } = await supabase
      .from("Package")
      .insert([packageData])
      .select()
      .single();

    if (error) {
      console.error("Error creating package:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to create package",
        details: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      package: {
        id: newPackage.id,
        name: newPackage.name,
        description: newPackage.description,
        packageType: newPackage.packageType,
        targetRole: newPackage.targetRole,
        price: parseFloat(newPackage.price),
        originalPrice: parseFloat(newPackage.originalPrice),
        outletFee: parseFloat(newPackage.outletFee),
        passCount: newPackage.passCount,
        validityDays: newPackage.validityDays,
        isActive: newPackage.isActive,
        createdAt: newPackage.createdAt
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
    const {
      name,
      description,
      packageType,
      targetRole,
      price,
      originalPrice,
      outletFee,
      packageContents,
      validityDays,
      isActive
    } = req.body;

    // Validate required fields if provided
    if (packageType && !['HALF_DAY', 'FULL_DAY', 'SEMESTER_BUNDLE'].includes(packageType)) {
      return res.status(400).json({
        error: "Invalid packageType",
        message: "packageType must be HALF_DAY, FULL_DAY, or SEMESTER_BUNDLE"
      });
    }

    // Validate passCount if provided
    if (packageContents && packageContents.passCount) {
      if (packageContents.passCount <= 0) {
        return res.status(400).json({
          error: "Invalid passCount",
          message: "passCount must be greater than 0"
        });
      }
    }

    if (targetRole && !['MEMBER', 'TUTOR', 'STUDENT'].includes(targetRole)) {
      return res.status(400).json({
        error: "Invalid targetRole",
        message: "targetRole must be MEMBER, TUTOR, or STUDENT"
      });
    }

    // Map frontend field names to database field names
    const updateData = {
      name: name,
      description: description,
      packageType: packageType,
      targetRole: targetRole,
      price: price ? parseFloat(price) : undefined,
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      outletFee: outletFee ? parseFloat(outletFee) : undefined,
      passCount: packageContents?.passCount ? parseInt(packageContents.passCount) : undefined,
      validityDays: validityDays ? parseInt(validityDays) : undefined,
      isActive: isActive,
      updatedAt: new Date().toISOString()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    console.log("Updating package with data:", updateData);
    console.log("Package ID:", id);

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
        message: "Failed to update package",
        details: error.message
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
        packageType: updatedPackage.packageType,
        targetRole: updatedPackage.targetRole,
        price: parseFloat(updatedPackage.price),
        originalPrice: parseFloat(updatedPackage.originalPrice),
        outletFee: parseFloat(updatedPackage.outletFee),
        passCount: updatedPackage.passCount,
        validityDays: updatedPackage.validityDays,
        isActive: updatedPackage.isActive,
        updatedAt: updatedPackage.updatedAt
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
      .eq("packageId", id)
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
          packageType,
          targetRole
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
    if (userId) query = query.eq("userId", userId);
    if (packageId) query = query.eq("packageId", packageId);
    if (paymentStatus) query = query.eq("paymentStatus", paymentStatus.toUpperCase());
    if (role) query = query.eq("Package.targetRole", role.toUpperCase());

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    query = query
      .order("createdAt", { ascending: false })
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
      orderId: purchase.orderId,
      userId: purchase.userId,
      userEmail: purchase.User.email,
      userName: `${purchase.User.firstname} ${purchase.User.lastname}`,
      userMemberType: purchase.User.membertype,
      packageId: purchase.packageId,
      packageName: purchase.Package.name,
      packageType: purchase.Package.packageType,
      targetRole: purchase.Package.targetRole,
      quantity: purchase.quantity,
      totalAmount: parseFloat(purchase.totalAmount),
      paymentStatus: purchase.paymentStatus,
      paymentMethod: purchase.paymentmethod,
      hitpayReference: purchase.hitpayreference,
      isActive: purchase.isActive,
      activatedAt: purchase.activatedat,
      expiresAt: purchase.expiresat,
      customerInfo: purchase.customerInfo,
      createdAt: purchase.createdAt
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

// 🎯 Get user's package usage summary
exports.getUserPackageUsage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    const result = await getUserPackageUsage(userId);

    if (!result.success) {
      return res.status(500).json({
        error: "Failed to fetch package usage",
        message: result.error
      });
    }

    res.json({
      success: true,
      packageUsage: result.packageUsage
    });

  } catch (err) {
    console.error("getUserPackageUsage error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch package usage"
    });
  }
};