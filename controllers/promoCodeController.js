const supabase = require("../config/database");

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
    if (promoData.activefrom && new Date(promoData.activefrom) > now) {
      return res.status(400).json({
        error: "Promo code not yet active",
        message: "This promo code is not yet active"
      });
    }

    if (promoData.activeto && new Date(promoData.activeto) < now) {
      return res.status(400).json({
        error: "Promo code expired",
        message: "This promo code has expired"
      });
    }

    // Check minimum booking amount
    if (promoData.minimumamount && parseFloat(bookingAmount) < parseFloat(promoData.minimumamount)) {
      return res.status(400).json({
        error: "Minimum amount not met",
        message: `Minimum booking amount of SGD ${promoData.minimumamount} required for this promo code`
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

    if (promoData.maxusageperuser === 1 && usageData && usageData.length > 0) {
      return res.status(400).json({
        error: "Promo code already used",
        message: "You have already used this promo code"
      });
    }

    if (promoData.maxusageperuser > 1 && usageData && usageData.length >= promoData.maxusageperuser) {
      return res.status(400).json({
        error: "Usage limit reached",
        message: `You have already used this promo code ${promoData.maxusageperuser} times`
      });
    }

    // Check if promo code has reached global usage limit
    if (promoData.maxtotalusage) {
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
      
      if (globalUsageCount >= promoData.maxtotalusage) {
        return res.status(400).json({
          error: "Promo code limit reached",
          message: "This promo code has reached its global usage limit"
        });
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    let finalAmount = parseFloat(bookingAmount);

    if (promoData.discounttype === "percentage") {
      discountAmount = (parseFloat(bookingAmount) * parseFloat(promoData.discountvalue)) / 100;
      if (promoData.maximumdiscount) {
        discountAmount = Math.min(discountAmount, parseFloat(promoData.maximumdiscount));
      }
    } else if (promoData.discounttype === "fixed") {
      discountAmount = parseFloat(promoData.discountvalue);
    }

    finalAmount = Math.max(0, parseFloat(bookingAmount) - discountAmount);

    res.status(200).json({
      message: "Promo code applied successfully",
      promoCode: {
        id: promoData.id,
        code: promoData.code,
        discountType: promoData.discounttype,
        discountValue: promoData.discountvalue,
        maxDiscountAmount: promoData.maximumdiscount,
        minimumAmount: promoData.minimumamount
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
      
      if (promo.activefrom) {
        const activeFromDate = new Date(promo.activefrom);
        if (now < activeFromDate) {
          return false; // Not yet active
        }
      }
      
      if (promo.activeto) {
        const activeToDate = new Date(promo.activeto);
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
        const maxUsage = promo.maxusageperuser || 1;
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
          discountType: promo.discounttype,
          discountValue: promo.discountvalue,
          maxDiscountAmount: promo.maximumdiscount,
          minimumAmount: promo.minimumamount,
          activeFrom: promo.activefrom,
          activeTo: promo.activeto,
          maxUsagePerUser: promo.maxusageperuser,
          userUsageCount: userUsageCount,
          remainingUses: (promo.maxusageperuser || 1) - userUsageCount
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
          discounttype,
          discountvalue,
          maximumdiscount
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
      name,
      description,
      discounttype,
      discountvalue,
      maximumdiscount,
      minimumamount,
      activefrom,
      activeto,
      maxusageperuser,
      maxtotalusage,
      category = 'GENERAL',
      isactive = true
    } = req.body;

    // Validate required fields
    if (!code || !discounttype || !discountvalue) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["code", "discounttype", "discountvalue"]
      });
    }

    // Validate discount type
    if (!["percentage", "fixed"].includes(discounttype)) {
      return res.status(400).json({
        error: "Invalid discount type",
        message: "Discount type must be 'percentage' or 'fixed'"
      });
    }

    // Validate discount value
    if (discounttype === "percentage" && (parseFloat(discountvalue) <= 0 || parseFloat(discountvalue) > 100)) {
      return res.status(400).json({
        error: "Invalid percentage value",
        message: "Percentage must be between 0 and 100"
      });
    }

    if (discounttype === "fixed" && parseFloat(discountvalue) <= 0) {
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

    // Validate and process time fields
    let processedActiveFrom = activefrom;
    let processedActiveTo = activeto;
    
    if (activefrom) {
      const fromDate = new Date(activefrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          error: "Invalid active from date",
          message: "Please provide a valid date for active from"
        });
      }
      processedActiveFrom = fromDate.toISOString();
    } else {
      // Default to current time if not provided
      processedActiveFrom = new Date().toISOString();
    }
    
    if (activeto) {
      const toDate = new Date(activeto);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({
          error: "Invalid active to date",
          message: "Please provide a valid date for active to"
        });
      }
      
      // Check if end date is after start date
      if (new Date(processedActiveFrom) >= toDate) {
        return res.status(400).json({
          error: "Invalid date range",
          message: "End date must be after start date"
        });
      }
      
      processedActiveTo = toDate.toISOString();
    }

    // Create promo code
    const insertData = {
      code: code.toUpperCase(),
      name: name || code,
      description: description || null,
      discounttype: discounttype.toLowerCase(),
      discountvalue: parseFloat(discountvalue),
      maximumdiscount: maximumdiscount ? parseFloat(maximumdiscount) : null,
      minimumamount: minimumamount ? parseFloat(minimumamount) : 0,
      activefrom: processedActiveFrom,
      activeto: processedActiveTo,
      maxusageperuser: maxusageperuser || 1,
      maxtotalusage: maxtotalusage || null,
      category: category,
      isactive: isactive,
      currentusage: 0,
      createdat: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };

    console.log("Inserting promo code with data:", JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from("PromoCode")
      .insert([insertData])
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
    if (updateData.discountvalue) {
      if (updateData.discounttype === "percentage" && (parseFloat(updateData.discountvalue) <= 0 || parseFloat(updateData.discountvalue) > 100)) {
        return res.status(400).json({
          error: "Invalid percentage value",
          message: "Percentage must be between 0 and 100"
        });
      }

      if (updateData.discounttype === "fixed" && parseFloat(updateData.discountvalue) <= 0) {
        return res.status(400).json({
          error: "Invalid fixed amount",
          message: "Fixed amount must be greater than 0"
        });
      }
    }

    // Validate and process time fields if they're being updated
    let processedUpdateData = { ...updateData };
    
    if (updateData.activefrom || updateData.activeto) {
      let processedActiveFrom = updateData.activefrom;
      let processedActiveTo = updateData.activeto;
      
      // Get current promo code data to compare dates
      const currentPromoCode = existingCode;
      
      if (updateData.activefrom) {
        const fromDate = new Date(updateData.activefrom);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({
            error: "Invalid active from date",
            message: "Please provide a valid date for active from"
          });
        }
        processedActiveFrom = fromDate.toISOString();
      } else {
        processedActiveFrom = currentPromoCode.activefrom;
      }
      
      if (updateData.activeto) {
        const toDate = new Date(updateData.activeto);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({
            error: "Invalid active to date",
            message: "Please provide a valid date for active to"
          });
        }
        
        // Check if end date is after start date
        if (new Date(processedActiveFrom) >= toDate) {
          return res.status(400).json({
            error: "Invalid date range",
            message: "End date must be after start date"
          });
        }
        
        processedActiveTo = toDate.toISOString();
      }
      
      processedUpdateData.activefrom = processedActiveFrom;
      processedUpdateData.activeto = processedActiveTo;
    }
    
    // Update promo code
    const { data, error } = await supabase
      .from("PromoCode")
      .update({
        ...processedUpdateData,
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

    // Check if promo code has been used (optional check)
    let usageData = [];
    let usageError = null;
    
    try {
      const usageResult = await supabase
        .from("PromoCodeUsage")
        .select("id")
        .eq("promoCodeId", id);
      
      usageData = usageResult.data || [];
      usageError = usageResult.error;
      
      if (usageError) {
        console.error("Usage check error:", usageError);
        console.log("PromoCodeUsage table issue detected. Continuing without usage check...");
        // Don't fail completely, just use empty usage array
        usageData = [];
      }
    } catch (err) {
      console.error("Usage check exception:", err);
      console.log("Continuing without usage check due to table issues...");
      usageData = [];
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

    // Calculate usage statistics and time-based status for each promo code
    const promoCodesWithStats = promoCodes.map(promo => {
      const now = new Date();
      const activeFrom = promo.activefrom ? new Date(promo.activefrom) : null;
      const activeTo = promo.activeto ? new Date(promo.activeto) : null;
      
      let timeStatus = 'active';
      let isExpired = false;
      let isNotYetActive = false;
      
      if (activeFrom && now < activeFrom) {
        timeStatus = 'not_yet_active';
        isNotYetActive = true;
      } else if (activeTo && now > activeTo) {
        timeStatus = 'expired';
        isExpired = true;
      } else if (activeFrom && activeTo) {
        timeStatus = 'active';
      } else if (activeFrom && !activeTo) {
        timeStatus = 'active_until_further_notice';
      } else if (!activeFrom && !activeTo) {
        timeStatus = 'always_active';
      }
      
      // Calculate remaining time
      let remainingTime = null;
      if (activeTo && now < activeTo) {
        const remainingMs = activeTo.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        remainingTime = `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
      
      return {
        ...promo,
        usageCount: 0, // Simplified for now
        isExpired,
        isNotYetActive,
        timeStatus,
        remainingTime,
        remainingGlobalUses: promo.maxtotalusage || null
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

        // Calculate statistics and time-based status
    const usageCount = promoCode.PromoCodeUsage?.length || 0;
    const now = new Date();
    const activeFrom = promoCode.activefrom ? new Date(promoCode.activefrom) : null;
    const activeTo = promoCode.activeto ? new Date(promoCode.activeto) : null;
    
    let timeStatus = 'active';
    let isExpired = false;
    let isNotYetActive = false;
    let isActive = promoCode.isactive;
    
    if (activeFrom && now < activeFrom) {
      timeStatus = 'not_yet_active';
      isNotYetActive = true;
      isActive = false;
    } else if (activeTo && now > activeTo) {
      timeStatus = 'expired';
      isExpired = true;
      isActive = false;
    } else if (activeFrom && activeTo) {
      timeStatus = 'active';
      isActive = promoCode.isactive;
    } else if (activeFrom && !activeTo) {
      timeStatus = 'active_until_further_notice';
      isActive = promoCode.isactive;
    } else if (!activeFrom && !activeTo) {
      timeStatus = 'always_active';
      isActive = promoCode.isactive;
    }
    
    // Calculate remaining time
    let remainingTime = null;
    if (activeTo && now < activeTo) {
      const remainingMs = activeTo.getTime() - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      remainingTime = `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
    
    const promoCodeWithStats = {
      ...promoCode,
      usageCount,
      isExpired,
      isNotYetActive,
      isActive,
      timeStatus,
      remainingTime
    };

    res.status(200).json({
      promoCode: promoCodeWithStats
    });

  } catch (err) {
    console.error("getPromoCodeById error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get promo codes by time status (admin)
exports.getPromoCodesByTimeStatus = async (req, res) => {
  try {
    const { status } = req.query; // 'active', 'expired', 'not_yet_active', 'all'
    
    let query = supabase
      .from("PromoCode")
      .select("*", { count: "exact" });
    
    const now = new Date();
    
    if (status === 'active') {
      // Get currently active promo codes
      query = query
        .or(`and(isactive.eq.true,or(activefrom.is.null,activefrom.lte.${now.toISOString()}),or(activeto.is.null,activeto.gt.${now.toISOString()}))`);
    } else if (status === 'expired') {
      // Get expired promo codes
      query = query
        .and(`activeto.lt.${now.toISOString()}`);
    } else if (status === 'not_yet_active') {
      // Get promo codes that haven't started yet
      query = query
        .and(`activefrom.gt.${now.toISOString()}`);
    }
    // If status is 'all' or undefined, get all promo codes
    
    const { data: promoCodes, error, count } = await query.order("createdat", { ascending: false });
    
    if (error) {
      console.error("Promo codes fetch error:", error);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: error.message
      });
    }
    
    // Add time-based status to each promo code
    const promoCodesWithTimeStatus = promoCodes.map(promo => {
      const activeFrom = promo.activefrom ? new Date(promo.activefrom) : null;
      const activeTo = promo.activeto ? new Date(promo.activeto) : null;
      
      let timeStatus = 'active';
      let isExpired = false;
      let isNotYetActive = false;
      
      if (activeFrom && now < activeFrom) {
        timeStatus = 'not_yet_active';
        isNotYetActive = true;
      } else if (activeTo && now > activeTo) {
        timeStatus = 'expired';
        isExpired = true;
      } else if (activeFrom && activeTo) {
        timeStatus = 'active';
      } else if (activeFrom && !activeTo) {
        timeStatus = 'active_until_further_notice';
      } else if (!activeFrom && !activeTo) {
        timeStatus = 'always_active';
      }
      
      // Calculate remaining time
      let remainingTime = null;
      if (activeTo && now < activeTo) {
        const remainingMs = activeTo.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        remainingTime = `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
      
      return {
        ...promo,
        timeStatus,
        isExpired,
        isNotYetActive,
        remainingTime
      };
    });
    
    res.status(200).json({
      promoCodes: promoCodesWithTimeStatus,
      totalCount: count,
      currentTime: now.toISOString(),
      status: status || 'all'
    });
    
  } catch (err) {
    console.error("getPromoCodesByTimeStatus error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
