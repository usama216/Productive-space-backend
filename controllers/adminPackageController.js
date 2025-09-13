const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");

// 🎯 Get all packages for admin
exports.getPackages = async (req, res) => {
  try {
    console.log('📦 Fetching all packages for admin...');

    const { data: packages, error } = await supabase
      .from("Package")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Error fetching packages:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch packages"
      });
    }

    res.json({
      success: true,
      packages: packages || []
    });

  } catch (err) {
    console.error("getPackages error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to fetch packages"
    });
  }
};

// 🎯 Get package by ID for admin
exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    console.log(`📦 Fetching package ${id} for admin...`);

    const { data: package, error } = await supabase
      .from("Package")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching package:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch package"
      });
    }

    if (!package) {
      return res.status(404).json({
        success: false,
        error: "Package not found"
      });
    }

    res.json({
      success: true,
      package
    });

  } catch (err) {
    console.error("getPackageById error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to fetch package"
    });
  }
};

// 🎯 Create new package
exports.createPackage = async (req, res) => {
  try {
    const {
      name,
      description,
      packageType,
      targetRole,
      price,
      originalPrice,
      outletFee,
      passCount,
      validityDays,
      isActive
    } = req.body;

    // Validation
    if (!name || !packageType || !targetRole || !price || !passCount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Name, packageType, targetRole, price, and passCount are required"
      });
    }

    console.log('📦 Creating new package:', { name, packageType, targetRole });

    const packageData = {
      id: uuidv4(),
      name,
      description: description || null,
      packageType,
      targetRole,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      outletFee: parseFloat(outletFee) || 5.00,
      passCount: parseInt(passCount),
      validityDays: parseInt(validityDays) || 30,
      isActive: isActive !== undefined ? isActive : true
    };

    const { data: newPackage, error } = await supabase
      .from("Package")
      .insert([packageData])
      .select()
      .single();

    if (error) {
      console.error("Error creating package:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to create package"
      });
    }

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      package: newPackage
    });

  } catch (err) {
    console.error("createPackage error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to create package"
    });
  }
};

// 🎯 Update package
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
      passCount,
      validityDays,
      isActive
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    // Validation
    if (!name || !packageType || !targetRole || !price || !passCount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Name, packageType, targetRole, price, and passCount are required"
      });
    }

    console.log(`📦 Updating package ${id}...`);

    const updateData = {
      name,
      description: description || null,
      packageType,
      targetRole,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      outletFee: parseFloat(outletFee) || 5.00,
      passCount: parseInt(passCount),
      validityDays: parseInt(validityDays) || 30,
      isActive: isActive !== undefined ? isActive : true,
      updatedAt: new Date().toISOString()
    };

    const { data: updatedPackage, error } = await supabase
      .from("Package")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating package:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update package"
      });
    }

    if (!updatedPackage) {
      return res.status(404).json({
        success: false,
        error: "Package not found"
      });
    }

    res.json({
      success: true,
      message: "Package updated successfully",
      package: updatedPackage
    });

  } catch (err) {
    console.error("updatePackage error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to update package"
    });
  }
};

// 🎯 Delete package
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    console.log(`📦 Deleting package ${id}...`);

    // First check if package exists
    const { data: existingPackage, error: fetchError } = await supabase
      .from("Package")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingPackage) {
      return res.status(404).json({
        success: false,
        error: "Package not found"
      });
    }

    // Check if package has any purchases
    const { data: purchases, error: purchaseError } = await supabase
      .from("PackagePurchase")
      .select("id")
      .eq("packageId", id)
      .limit(1);

    if (purchaseError) {
      console.error("Error checking package purchases:", purchaseError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to check package purchases"
      });
    }

    if (purchases && purchases.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete package",
        message: "Package has existing purchases and cannot be deleted"
      });
    }

    // Delete the package
    const { error: deleteError } = await supabase
      .from("Package")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting package:", deleteError);
      return res.status(500).json({
        success: false,
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
      success: false,
      error: "Server error",
      message: "Failed to delete package"
    });
  }
};

// 🎯 Toggle package active status
exports.togglePackageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    console.log(`📦 Toggling package ${id} status to ${isActive}...`);

    const { data: updatedPackage, error } = await supabase
      .from("Package")
      .update({ 
        isActive: isActive,
        updatedAt: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error toggling package status:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update package status"
      });
    }

    if (!updatedPackage) {
      return res.status(404).json({
        success: false,
        error: "Package not found"
      });
    }

    res.json({
      success: true,
      message: `Package ${isActive ? 'activated' : 'deactivated'} successfully`,
      package: updatedPackage
    });

  } catch (err) {
    console.error("togglePackageStatus error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to update package status"
    });
  }
};

// 🎯 Get package statistics
exports.getPackageStats = async (req, res) => {
  try {
    console.log('📊 Fetching package statistics...');

    // Get total packages count
    const { count: totalPackages, error: totalError } = await supabase
      .from("Package")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      console.error("Error fetching total packages:", totalError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch package statistics"
      });
    }

    // Get active packages count
    const { count: activePackages, error: activeError } = await supabase
      .from("Package")
      .select("*", { count: "exact", head: true })
      .eq("isActive", true);

    if (activeError) {
      console.error("Error fetching active packages:", activeError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch package statistics"
      });
    }

    // Get packages by type
    const { data: packagesByType, error: typeError } = await supabase
      .from("Package")
      .select("packageType, isActive")
      .eq("isActive", true);

    if (typeError) {
      console.error("Error fetching packages by type:", typeError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch package statistics"
      });
    }

    // Get total purchases count
    const { count: totalPurchases, error: purchasesError } = await supabase
      .from("PackagePurchase")
      .select("*", { count: "exact", head: true })
      .eq("paymentStatus", "COMPLETED");

    if (purchasesError) {
      console.error("Error fetching total purchases:", purchasesError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch package statistics"
      });
    }

    // Calculate type distribution
    const typeDistribution = packagesByType.reduce((acc, pkg) => {
      acc[pkg.packageType] = (acc[pkg.packageType] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      stats: {
        totalPackages: totalPackages || 0,
        activePackages: activePackages || 0,
        inactivePackages: (totalPackages || 0) - (activePackages || 0),
        totalPurchases: totalPurchases || 0,
        typeDistribution
      }
    });

  } catch (err) {
    console.error("getPackageStats error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to fetch package statistics"
    });
  }
};
