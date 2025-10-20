const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");
const { getUserPackageUsage } = require("../utils/packageUsageHelper");

exports.getPackagesByRole = async (req, res) => {
  try {
    const { role } = req.params;

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
      hoursAllowed: pkg.hoursAllowed,
      discount: pkg.originalPrice ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0
    }));

    res.json({
      success: true,
      role: role.toUpperCase(),
      packages: formattedPackages,
      totalPackages: formattedPackages.length
    });

  } catch (err) {
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
      hoursAllowed: package.hoursAllowed || (package.packageType === 'HALF_DAY' ? 4 : package.packageType === 'FULL_DAY' ? 8 : 4),
      discount: package.originalPrice ? Math.round(((package.originalPrice - package.price) / package.originalPrice) * 100) : 0
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
      customerInfo,
      totalAmount,
      paymentMethod
    } = req.body;

    if (!userId || !packageId || !customerInfo) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "userId, packageId, and customerInfo are required"
      });
    }

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

    const baseAmount = parseFloat(package.price) * quantity;
    const outletFee = parseFloat(package.outletFee) * quantity;
    const calculatedTotalAmount = baseAmount + outletFee;

    const finalTotalAmount = totalAmount ? parseFloat(totalAmount) : calculatedTotalAmount;
    const orderId = `PKG_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const { data: packagePurchase, error: purchaseError } = await supabase
      .from("PackagePurchase")
      .insert([{
        id: uuidv4(),
        userId: userId,
        packageId: packageId,
        quantity: quantity,
        totalAmount: finalTotalAmount,
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod,
        customerInfo: customerInfo,
        orderId: orderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (purchaseError) {
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
    res.status(500).json({
      error: "Server error",
      message: "Failed to process package purchase"
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
          validityDays,
          hoursAllowed
        )
      `)
      .eq("userId", userId)
      .eq("paymentStatus", "COMPLETED")  // Changed: Only show COMPLETED packages instead of isActive check
      .order("createdAt", { ascending: false });

    if (error) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch user packages"
      });
    }

    const purchasesWithPasses = await Promise.all(
      purchases.map(async (purchase) => {
        const { data: passes, error: passesError } = await supabase
          .from("UserPass")
          .select("id, status, totalCount, remainingCount")
          .eq("packagepurchaseid", purchase.id);

        if (passesError) {
          console.error("Error fetching passes for purchase", purchase.id, ":", passesError);
          return purchase;
        }

        // Total passes should always be from Package.passCount (the original package size)
        // Not the sum of UserPass.totalCount (which could have duplicates due to race conditions)
        const totalPasses = purchase.Package.passCount || 0;
        
        let activePasses = 0;
        let expiredPasses = 0;

        if (passes && passes.length > 0) {
          // Sum up remaining count from all ACTIVE passes
          // (Handle case where duplicate UserPass records exist)
          passes.forEach(pass => {
            if (pass.status === "ACTIVE") {
              activePasses += pass.remainingCount || 0;
            }
            if (pass.status === "EXPIRED") {
              expiredPasses += pass.totalCount || 0;
            }
          });
        } else {
          // No UserPass exists yet - use package defaults if payment completed
          if (purchase.paymentStatus === 'COMPLETED') {
            activePasses = totalPasses;
          }
        }

        // Calculate used passes as: total - remaining
        // Cap at totalPasses to avoid showing more used than total (in case of duplicates)
        const usedPasses = Math.min(totalPasses - activePasses, totalPasses);

        const finalTotalPasses = totalPasses;
        const finalActivePasses = Math.min(activePasses, totalPasses); // Cap at totalPasses
        const finalUsedPasses = Math.max(usedPasses, 0); // Never negative
        const finalExpiredPasses = expiredPasses;


        let activatedAt = purchase.activatedAt;
        let expiresAt = purchase.expiresAt;

        if (purchase.paymentStatus === 'COMPLETED' && !activatedAt) {
          activatedAt = purchase.createdAt;
        }

        if (purchase.paymentStatus === 'COMPLETED' && !expiresAt) {
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
          hoursAllowed: purchase.Package.hoursAllowed || 4, // Default to 4 hours if not set
          quantity: purchase.quantity,
          totalAmount: parseFloat(purchase.totalAmount),
          paymentStatus: purchase.paymentStatus,
          paymentMethod: purchase.paymentMethod,
          activatedAt: activatedAt,
          expiresAt: expiresAt,
          isExpired: expiresAt ? new Date() > new Date(expiresAt) : false,
          totalPasses: finalTotalPasses,
          usedPasses: finalUsedPasses,
          remainingPasses: finalActivePasses,
          expiredPasses: finalExpiredPasses,
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
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch user packages"
    });
  }
};


exports.getAllPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, packageType, isActive } = req.query;

    let query = supabase
      .from("Package")
      .select("*", { count: 'exact' });

    if (role) query = query.eq("targetRole", role.toUpperCase());
    if (packageType) query = query.eq("packageType", packageType.toUpperCase());
    if (isActive !== undefined) query = query.eq("isActive", isActive === 'true');

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    query = query
      .order("createdAt", { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: packages, error, count } = await query;

    if (error) {
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch packages"
      });
    }

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
      hoursAllowed: pkg.hoursAllowed,
      isActive: pkg.isActive,
      discount: pkg.originalPrice ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt
    }));

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
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch packages"
    });
  }
};

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

    if (!name || !packageType || !targetRole || !price) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "name, packageType, targetRole, and price are required"
      });
    }

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


    const { data: newPackage, error } = await supabase
      .from("Package")
      .insert([packageData])
      .select()
      .single();

    if (error) {
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
        hoursAllowed: newPackage.hoursAllowed || (newPackage.packageType === 'HALF_DAY' ? 4 : newPackage.packageType === 'FULL_DAY' ? 8 : 4),
        isActive: newPackage.isActive,
        createdAt: newPackage.createdAt
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to create package"
    });
  }
};

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

    if (packageType && !['HALF_DAY', 'FULL_DAY', 'SEMESTER_BUNDLE'].includes(packageType)) {
      return res.status(400).json({
        error: "Invalid packageType",
        message: "packageType must be HALF_DAY, FULL_DAY, or SEMESTER_BUNDLE"
      });
    }

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

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });


    const { data: updatedPackage, error } = await supabase
      .from("Package")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
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
        hoursAllowed: updatedPackage.hoursAllowed || (updatedPackage.packageType === 'HALF_DAY' ? 4 : updatedPackage.packageType === 'FULL_DAY' ? 8 : 4),
        isActive: updatedPackage.isActive,
        updatedAt: updatedPackage.updatedAt
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: "Failed to update package"
    });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: purchases, error: checkError } = await supabase
      .from("PackagePurchase")
      .select("id")
      .eq("packageId", id)
      .limit(1);

    if (checkError) {
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


    const { error } = await supabase
      .from("Package")
      .delete()
      .eq("id", id);

    if (error) {
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
    res.status(500).json({
      error: "Server error",
      message: "Failed to delete package"
    });
  }
};

exports.getAllPackagePurchases = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId, packageId, paymentStatus, role } = req.query;

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

    if (userId) query = query.eq("userId", userId);
    if (packageId) query = query.eq("packageId", packageId);
    if (paymentStatus) query = query.eq("paymentStatus", paymentStatus.toUpperCase());
    if (role) query = query.eq("Package.targetRole", role.toUpperCase());

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
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch package purchases"
    });
  }
};

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
    res.status(500).json({
      error: "Server error",
      message: "Failed to fetch package usage"
    });
  }
};