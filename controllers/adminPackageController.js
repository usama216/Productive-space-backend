const { v4: uuidv4 } = require("uuid");
const supabase = require("../config/database");

exports.getPackages = async (req, res) => {
  try {
    const { search, packageType, targetRole, status } = req.query;

    // Build query
    let query = supabase
      .from("Package")
      .select("*");

    // Apply filters
    if (search) {
      // Sanitize search input to prevent SQL injection
      const { sanitizeSearchQuery, buildSafeOrQuery } = require("../utils/inputSanitizer");
      const sanitizedSearch = sanitizeSearchQuery(search);
      if (sanitizedSearch) {
        // Contain-based search: search in name and description
        // Using ilike with %value% for contain-based matching (case-insensitive partial match)
        // This handles spaces properly - "half day" will match packages containing "half day"
        const orConditions = buildSafeOrQuery([
          { field: 'name', operator: 'ilike', value: `%${sanitizedSearch}%` },
          { field: 'description', operator: 'ilike', value: `%${sanitizedSearch}%` }
        ]);
        if (orConditions) {
          query = query.or(orConditions);
        }
      }
    }

    if (packageType) {
      query = query.eq("packageType", packageType);
    }

    if (targetRole) {
      query = query.eq("targetRole", targetRole);
    }

    if (status) {
      const isActive = status === 'active';
      query = query.eq("isActive", isActive);
    }

    // Order by creation date
    query = query.order("createdAt", { ascending: false });

    const { data: packages, error } = await query;

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
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to fetch packages"
    });
  }
};

exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    const { data: package, error } = await supabase
      .from("Package")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
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
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to fetch package"
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
          passCount,
          validityDays,
          isActive,
          hoursAllowed
        } = req.body;

    if (!name || !packageType || !targetRole || !price || !passCount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Name, packageType, targetRole, price, and passCount are required"
      });
    }

    // Check for duplicate package name
    const { data: existingPackage, error: checkError } = await supabase
      .from("Package")
      .select("id, name")
      .ilike("name", name.trim())
      .single();

    if (existingPackage) {
      return res.status(409).json({
        success: false,
        error: "Duplicate package name",
        message: `A package with the name "${name}" already exists. Please use a different name.`
      });
    }

            const packageData = {
              id: uuidv4(),
              name,
              description: description || null,
              packageType,
              targetRole,
              price: parseFloat(price),
              originalPrice: originalPrice ? parseFloat(originalPrice) : null,
              outletFee: 0.00,
              passCount: parseInt(passCount),
              validityDays: parseInt(validityDays) || 30,
              isActive: isActive !== undefined ? isActive : true,
              hoursAllowed: parseInt(hoursAllowed) || 4
            };

    const { data: newPackage, error } = await supabase
      .from("Package")
      .insert([packageData])
      .select()
      .single();

    if (error) {
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
    res.status(500).json({
      success: false,
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
          passCount,
          validityDays,
          isActive,
          hoursAllowed
        } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    if (!name || !packageType || !targetRole || !price || !passCount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Name, packageType, targetRole, price, and passCount are required"
      });
    }

    // Check for duplicate package name (excluding current package)
    const { data: existingPackage, error: checkError } = await supabase
      .from("Package")
      .select("id, name")
      .ilike("name", name.trim())
      .neq("id", id)
      .single();

    if (existingPackage) {
      return res.status(409).json({
        success: false,
        error: "Duplicate package name",
        message: `A package with the name "${name}" already exists. Please use a different name.`
      });
    }

            const updateData = {
              name,
              description: description || null,
              packageType,
              targetRole,
              price: parseFloat(price),
              originalPrice: originalPrice ? parseFloat(originalPrice) : null,
              outletFee: 0.00,
              passCount: parseInt(passCount),
              validityDays: parseInt(validityDays) || 30,
              isActive: isActive !== undefined ? isActive : true,
              hoursAllowed: parseInt(hoursAllowed) || 4,
              updatedAt: new Date().toISOString()
            };

    const { data: updatedPackage, error } = await supabase
      .from("Package")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
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

exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Allow force delete via query parameter

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Package ID is required"
      });
    }

    console.log(`📦 Deleting package ${id}... (force: ${force})`);

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

    // Check for existing purchases only if not force deleting
    if (force !== 'true') {
      const { data: purchases, error: purchaseError } = await supabase
        .from("PackagePurchase")
        .select("id")
        .eq("packageId", id)
        .limit(1);

      if (purchaseError) {
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
          message: "Package has existing purchases and cannot be deleted. Use force=true to override."
        });
      }
    }

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
      message: force === 'true' ? "Package force deleted successfully" : "Package deleted successfully"
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
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to update package status"
    });
  }
};

exports.getPackageStats = async (req, res) => {
  try {
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

    const { count: totalPurchases, error: purchasesError } = await supabase
      .from("PackagePurchase")
      .select("*", { count: "exact", head: true })
      .eq("paymentStatus", "COMPLETED");

    if (purchasesError) {
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch package statistics"
      });
    }

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
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to fetch package statistics"
    });
  }
};
