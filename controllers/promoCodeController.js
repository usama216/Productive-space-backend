const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==================== TEST ENDPOINT ====================
// Test endpoint to check database connection and table status
exports.testPromoCodeTable = async (req, res) => {
  try {
    console.log("Testing PromoCode table connection...");
    
    // Test 1: Check if PromoCode table exists and has data
    const { data: tableCheck, error: tableError } = await supabase
      .from("PromoCode")
      .select("id")
      .limit(1);
    
    if (tableError) {
      console.error("PromoCode table check error:", tableError);
      return res.status(500).json({
        error: "PromoCode table not accessible",
        details: tableError.message,
        hint: "Check if table exists and has correct permissions"
      });
    }
    
    // Test 2: Count total records in PromoCode
    const { count: totalCount, error: countError } = await supabase
      .from("PromoCode")
      .select("*", { count: "exact", head: true });
    
    if (countError) {
      console.error("PromoCode count error:", countError);
      return res.status(500).json({
        error: "Failed to count promo codes",
        details: countError.message
      });
    }
    
    // Test 3: Get sample data with column info from PromoCode
    const { data: sampleData, error: sampleError } = await supabase
      .from("PromoCode")
      .select("*")
      .limit(3);
    
    if (sampleError) {
      console.error("PromoCode sample data error:", sampleError);
      return res.status(500).json({
        error: "Failed to fetch sample data",
        details: sampleError.message
      });
    }
    
    // Test 4: Check PromoCodeUsage table
    let usageTableStatus = "NOT_CHECKED";
    let usageTableError = null;
    let usageTableColumns = [];
    
    try {
      const { data: usageCheck, error: usageError } = await supabase
        .from("PromoCodeUsage")
        .select("id")
        .limit(1);
      
      if (usageError) {
        usageTableStatus = "ERROR";
        usageTableError = usageError.message;
        console.error("PromoCodeUsage table check error:", usageError);
      } else {
        usageTableStatus = "EXISTS";
        // Try to get column info
        const { data: usageSample, error: usageSampleError } = await supabase
          .from("PromoCodeUsage")
          .select("*")
          .limit(1);
        
        if (!usageSampleError && usageSample && usageSample.length > 0) {
          usageTableColumns = Object.keys(usageSample[0]);
        }
      }
    } catch (err) {
      usageTableStatus = "EXCEPTION";
      usageTableError = err.message;
      console.error("PromoCodeUsage table check exception:", err);
    }
    
    // Check what columns exist in PromoCode by looking at sample data
    let availableColumns = [];
    if (sampleData && sampleData.length > 0) {
      availableColumns = Object.keys(sampleData[0]);
      console.log("Available columns in PromoCode table:", availableColumns);
    }
    
    res.status(200).json({
      message: "Database connection test completed",
      promocodeTable: {
        exists: true,
        totalCount: totalCount || 0,
        sampleData: sampleData || [],
        availableColumns: availableColumns
      },
      promocodeUsageTable: {
        status: usageTableStatus,
        error: usageTableError,
        availableColumns: usageTableColumns
      },
      connectionStatus: "SUCCESS"
    });
    
  } catch (err) {
    console.error("Test endpoint error:", err);
    res.status(500).json({
      error: "Test failed",
      message: err.message,
      stack: err.stack
    });
  }
};

// ==================== USER/CLIENT APIs ====================

// Apply promo code during booking
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode, userId, bookingAmount } = req.body;

    if (!promoCode || !userId || !bookingAmount) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["promoCode", "userId", "bookingAmount"]
      });
    }

    // Get promo code details
    const { data: promoData, error: promoError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("code", promoCode.toUpperCase())
      .eq("isactive", true)
      .single();

    if (promoError || !promoData) {
      return res.status(404).json({
        error: "Invalid promo code",
        message: "The promo code you entered is not valid or has expired"
      });
    }

    // Check if promo code is expired
    const now = new Date();
    if (promoData.activeFrom && new Date(promoData.activeFrom) > now) {
      return res.status(400).json({
        error: "Promo code not yet active",
        message: "This promo code is not yet active"
      });
    }

    if (promoData.activeTo && new Date(promoData.activeTo) < now) {
      return res.status(400).json({
        error: "Promo code expired",
        message: "This promo code has expired"
      });
    }

    // Check minimum booking amount
    if (promoData.minimumAmount && parseFloat(bookingAmount) < parseFloat(promoData.minimumAmount)) {
      return res.status(400).json({
        error: "Minimum amount not met",
        message: `Minimum booking amount of SGD ${promoData.minimumAmount} required for this promo code`
      });
    }

    // Check if user has already used this promo code
    let usageData = [];
    let usageError = null;
    
    try {
      const usageResult = await supabase
        .from("PromoCodeUsage")
        .select("*")
        .eq("promoCodeId", promoData.id)
        .eq("userId", userId);
      
      usageData = usageResult.data || [];
      usageError = usageResult.error;
      
      if (usageError) {
        console.error("Usage check error:", usageError);
        console.log("Table structure issue detected. Continuing without usage check...");
        // Don't fail completely, just use empty usage array
        usageData = [];
      }
    } catch (err) {
      console.error("Usage check exception:", err);
      console.log("Continuing without usage check due to table issues...");
      usageData = [];
    }

    if (promoData.maxUsagePerUser === 1 && usageData && usageData.length > 0) {
      return res.status(400).json({
        error: "Promo code already used",
        message: "You have already used this promo code"
      });
    }

    if (promoData.maxUsagePerUser > 1 && usageData && usageData.length >= promoData.maxUsagePerUser) {
      return res.status(400).json({
        error: "Usage limit reached",
        message: `You have already used this promo code ${promoData.maxUsagePerUser} times`
      });
    }

    // Check if promo code has reached global usage limit
    if (promoData.maxTotalUsage) {
      let globalUsageCount = 0;
      let globalCountError = null;
      
      try {
        const globalResult = await supabase
          .from("PromoCodeUsage")
          .select("*", { count: "exact", head: true })
          .eq("promoCodeId", promoData.id);
        
        globalUsageCount = globalResult.count || 0;
        globalCountError = globalResult.error;
        
        if (globalCountError) {
          console.error("Global usage count error:", globalCountError);
          console.log("Table structure issue detected. Skipping global usage check...");
          globalUsageCount = 0; // Skip the check
        }
      } catch (err) {
        console.error("Global usage check exception:", err);
        console.log("Skipping global usage check due to table issues...");
        globalUsageCount = 0; // Skip the check
      }
      
      if (globalUsageCount >= promoData.maxTotalUsage) {
        return res.status(400).json({
          error: "Promo code limit reached",
          message: "This promo code has reached its global usage limit"
        });
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    let finalAmount = parseFloat(bookingAmount);

    if (promoData.discountType === "percentage") {
      discountAmount = (parseFloat(bookingAmount) * parseFloat(promoData.discountValue)) / 100;
      if (promoData.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, parseFloat(promoData.maxDiscountAmount));
      }
    } else if (promoData.discountType === "fixed") {
      discountAmount = parseFloat(promoData.discountValue);
    }

    finalAmount = Math.max(0, parseFloat(bookingAmount) - discountAmount);

    res.status(200).json({
      message: "Promo code applied successfully",
      promoCode: {
        id: promoData.id,
        code: promoData.code,
        discountType: promoData.discountType,
        discountValue: promoData.discountValue,
        maxDiscountAmount: promoData.maxDiscountAmount,
        minimumAmount: promoData.minimumAmount
      },
      calculation: {
        originalAmount: parseFloat(bookingAmount),
        discountAmount: discountAmount,
        finalAmount: finalAmount
      }
    });

  } catch (err) {
    console.error("applyPromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get available promo codes for logged-in user - FIXED VERSION
exports.getUserAvailablePromos = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("getUserAvailablePromos called for userId:", userId);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const now = new Date();

    // Get all active promo codes with proper date filtering
    let query = supabase
      .from("PromoCode")
      .select("*")
      .eq("isactive", true);

    // Apply date filters only if the columns exist and have values
    // First, let's get all active promo codes and filter in JavaScript
    const { data: promoCodes, error: promosError } = await query;

    if (promosError) {
      console.error("Promo codes fetch error:", promosError);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: promosError.message
      });
    }

    console.log("Found", promoCodes?.length || 0, "active promo codes");

    // Filter promo codes by date validity in JavaScript
    const validPromoCodes = promoCodes.filter(promo => {
      // Check if promo code is currently active based on dates
      const isActiveByDate = true; // Default to true if no date constraints
      
      if (promo.activeFrom) {
        const activeFromDate = new Date(promo.activeFrom);
        if (now < activeFromDate) {
          return false; // Not yet active
        }
      }
      
      if (promo.activeTo) {
        const activeToDate = new Date(promo.activeTo);
        if (now > activeToDate) {
          return false; // Expired
        }
      }
      
      return isActiveByDate;
    });

    console.log("Found", validPromoCodes.length, "valid promo codes after date filtering");

    // Get user's usage for each promo code
    const { data: userUsage, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select("promoCodeId, usedAt")
      .eq("userId", userId);

    if (usageError) {
      console.error("User usage fetch error:", usageError);
      // Don't fail completely, just use empty usage array
      console.log("Continuing with empty usage data");
    }

    const userUsageData = userUsage || [];

    // Filter and format available promo codes
    const availablePromos = validPromoCodes
      .filter(promo => {
        const userUsageCount = userUsageData.filter(usage => usage.promoCodeId === promo.id).length;
        const maxUsage = promo.maxUsagePerUser || 1;
        const isAvailable = userUsageCount < maxUsage;
        
        console.log(`Promo ${promo.code}: userUsageCount=${userUsageCount}, maxUsage=${maxUsage}, isAvailable=${isAvailable}`);
        
        return isAvailable;
      })
      .map(promo => {
        const userUsageCount = userUsageData.filter(usage => usage.promoCodeId === promo.id).length;
        return {
          id: promo.id,
          code: promo.code,
          description: promo.description,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          maxDiscountAmount: promo.maxDiscountAmount,
          minimumAmount: promo.minimumAmount,
          activeFrom: promo.activeFrom,
          activeTo: promo.activeTo,
          maxUsagePerUser: promo.maxUsagePerUser,
          userUsageCount: userUsageCount,
          remainingUses: (promo.maxUsagePerUser || 1) - userUsageCount
        };
      });

    console.log("Returning", availablePromos.length, "available promo codes");

    res.status(200).json({
      availablePromos,
      totalCount: availablePromos.length
    });

  } catch (err) {
    console.error("getUserAvailablePromos error:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: err.message,
      details: err.stack
    });
  }
};

// Get user's used promo codes
exports.getUserUsedPromos = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get user's promo code usage with promo code details
    const { data: usedPromos, error: usedError } = await supabase
      .from("PromoCodeUsage")
      .select(`
        *,
        PromoCode (
          id,
          code,
          description,
          discountType,
          discountValue,
          maxDiscountAmount
        )
      `)
      .eq("userId", userId)
      .order("usedAt", { ascending: false });

    if (usedError) {
      console.error("Used promos fetch error:", usedError);
      return res.status(500).json({ error: "Failed to fetch used promo codes" });
    }

    res.status(200).json({
      usedPromos,
      totalCount: usedPromos.length
    });

  } catch (err) {
    console.error("getUserUsedPromos error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ==================== ADMIN APIs ====================

// Create new promo code
exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumAmount,
          activeFrom,
    activeTo,
    maxUsagePerUser,
    maxTotalUsage,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["code", "discountType", "discountValue"]
      });
    }

    // Validate discount type
    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({
        error: "Invalid discount type",
        message: "Discount type must be 'percentage' or 'fixed'"
      });
    }

    // Validate discount value
    if (discountType === "percentage" && (parseFloat(discountValue) <= 0 || parseFloat(discountValue) > 100)) {
      return res.status(400).json({
        error: "Invalid percentage value",
        message: "Percentage must be between 0 and 100"
      });
    }

    if (discountType === "fixed" && parseFloat(discountValue) <= 0) {
      return res.status(400).json({
        error: "Invalid fixed amount",
        message: "Fixed amount must be greater than 0"
      });
    }

    // Check if promo code already exists
    const { data: existingCode, error: checkError } = await supabase
      .from("PromoCode")
      .select("id")
      .eq("code", code.toUpperCase())
      .single();

    if (existingCode && !checkError) {
      return res.status(409).json({
        error: "Promo code already exists",
        message: "A promo code with this code already exists"
      });
    }

    // Create promo code
    const { data, error } = await supabase
      .from("PromoCode")
      .insert([{
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue: parseFloat(discountValue),
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        minimumAmount: minimumAmount ? parseFloat(minimumAmount) : null,
            activeFrom: activeFrom || new Date().toISOString(),
    activeTo: activeTo || null,
    maxUsagePerUser: maxUsagePerUser || 1,
    maxTotalUsage: maxTotalUsage || null,
        isactive: isActive,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error("Promo code creation error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: "Promo code created successfully",
      promoCode: data
    });

  } catch (err) {
    console.error("createPromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update promo code
exports.updatePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ error: "Promo code ID is required" });
    }

    // Check if promo code exists
    const { data: existingCode, error: checkError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("id", id)
      .single();

    if (checkError || !existingCode) {
      return res.status(404).json({
        error: "Promo code not found",
        message: `No promo code found with ID: ${id}`
      });
    }

    // Validate discount value if being updated
    if (updateData.discountValue) {
      if (updateData.discountType === "percentage" && (parseFloat(updateData.discountValue) <= 0 || parseFloat(updateData.discountValue) > 100)) {
        return res.status(400).json({
          error: "Invalid percentage value",
          message: "Percentage must be between 0 and 100"
        });
      }

      if (updateData.discountType === "fixed" && parseFloat(updateData.discountValue) <= 0) {
        return res.status(400).json({
          error: "Invalid fixed amount",
          message: "Fixed amount must be greater than 0"
        });
      }
    }

    // Update promo code
    const { data, error } = await supabase
      .from("PromoCode")
      .update({
        ...updateData,
        updatedat: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Promo code update error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: "Promo code updated successfully",
      promoCode: data
    });

  } catch (err) {
    console.error("updatePromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete promo code
exports.deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Promo code ID is required" });
    }

    // Check if promo code exists
    const { data: existingCode, error: checkError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("id", id)
      .single();

    if (checkError || !existingCode) {
      return res.status(404).json({
        error: "Promo code not found",
        message: `No promo code found with ID: ${id}`
      });
    }

    // Check if promo code has been used
    const { data: usageData, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select("id")
      .eq("promoCodeId", id);

    if (usageError) {
      console.error("Usage check error:", usageError);
      return res.status(500).json({ error: "Failed to check promo code usage" });
    }

    if (usageData && usageData.length > 0) {
      return res.status(400).json({
        error: "Cannot delete used promo code",
        message: "This promo code has been used and cannot be deleted. Consider deactivating it instead."
      });
    }

    // Delete promo code
    const { error } = await supabase
      .from("PromoCode")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Promo code deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: "Promo code deleted successfully",
      deletedPromoCode: existingCode
    });

  } catch (err) {
    console.error("deletePromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all promo codes (admin) - SIMPLIFIED VERSION
exports.getAllPromoCodes = async (req, res) => {
  try {
    console.log("getAllPromoCodes called with query:", req.query);
    
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (page - 1) * limit;

    // First, try to get all promo codes without complex joins
    let query = supabase
      .from("PromoCode")
      .select("*", { count: "exact" });

    // Apply filters
    if (search) {
      query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (status === "active") {
      query = query.eq("isactive", true);
    } else if (status === "inactive") {
      query = query.eq("isactive", false);
    }

    // Apply pagination - use id instead of createdAt if it doesn't exist
    query = query.range(offset, offset + limit - 1).order("id", { ascending: false });

    console.log("Executing query with offset:", offset, "limit:", limit);
    
    const { data: promoCodes, error, count } = await query;

    if (error) {
      console.error("Promo codes fetch error:", error);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: error.message,
        hint: "Check if PromoCode table exists and has data"
      });
    }

    console.log("Successfully fetched promo codes:", promoCodes?.length || 0);

    // Calculate usage statistics for each promo code
    const promoCodesWithStats = promoCodes.map(promo => {
      const isExpired = promo.activeTo && new Date(promo.activeTo) < new Date();
      
      return {
        ...promo,
        usageCount: 0, // Simplified for now
        isExpired,
        remainingGlobalUses: promo.maxTotalUsage || null
      };
    });

    const response = {
      promoCodes: promoCodesWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };

    console.log("Sending response with", promoCodesWithStats.length, "promo codes");
    res.status(200).json(response);

  } catch (err) {
    console.error("getAllPromoCodes error:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: err.message,
      stack: err.stack
    });
  }
};

// Get specific promo code details (admin)
exports.getPromoCodeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Promo code ID is required" });
    }

    // Get promo code with usage details
    const { data: promoCode, error } = await supabase
      .from("PromoCode")
      .select(`
        *,
        PromoCodeUsage (
          id,
          userId,
          usedAt,
          User (
            id,
            email,
            name
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !promoCode) {
      return res.status(404).json({
        error: "Promo code not found",
        message: `No promo code found with ID: ${id}`
      });
    }

    // Calculate statistics
    const usageCount = promoCode.PromoCodeUsage?.length || 0;
    const isExpired = promoCode.activeTo && new Date(promoCode.activeTo) < new Date();
    const isActive = promoCode.isactive && !isExpired;

    const promoCodeWithStats = {
      ...promoCode,
      usageCount,
      isExpired,
      isActive,
              remainingGlobalUses: promoCode.maxTotalUsage ? Math.max(0, promoCode.maxTotalUsage - usageCount) : null
    };

    res.status(200).json({
      promoCode: promoCodeWithStats
    });

  } catch (err) {
    console.error("getPromoCodeById error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
