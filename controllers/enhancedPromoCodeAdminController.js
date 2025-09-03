const supabase = require("../config/database");

// ==================== ADMIN APIs ====================

// Create new promo code with enhanced fields
exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumAmount,
      activeFrom,
      activeTo,
      promoType = 'GENERAL',
      targetGroup,
      targetUserIds,
      maxUsagePerUser = 1,
      globalUsageLimit,
      isActive = true,
      category = 'GENERAL',
      priority = 1
    } = req.body;

    // Validate required fields
    if (!code || !name || !discountType || !discountValue) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["code", "name", "discountType", "discountValue"]
      });
    }

    // Validate discount type
    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({
        error: "Invalid discount type",
        message: "Discount type must be 'percentage' or 'fixed'"
      });
    }

    // Validate promo type
    if (!["GENERAL", "GROUP_SPECIFIC", "USER_SPECIFIC", "WELCOME"].includes(promoType)) {
      return res.status(400).json({
        error: "Invalid promo type",
        message: "Promo type must be one of: GENERAL, GROUP_SPECIFIC, USER_SPECIFIC, WELCOME"
      });
    }

    // Validate target group for group-specific promo codes
    if (promoType === 'GROUP_SPECIFIC' && !targetGroup) {
      return res.status(400).json({
        error: "Target group required",
        message: "Target group is required for GROUP_SPECIFIC promo codes"
      });
    }

    // Validate target user IDs for user-specific promo codes
    if (promoType === 'USER_SPECIFIC' && (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0)) {
      return res.status(400).json({
        error: "Target user IDs required",
        message: "Target user IDs array is required for USER_SPECIFIC promo codes"
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

    // Validate and process time fields
    let processedActiveFrom = activeFrom;
    let processedActiveTo = activeTo;
    
    if (activeFrom) {
      const fromDate = new Date(activeFrom);
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
    
    if (activeTo) {
      const toDate = new Date(activeTo);
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
      name: name,
      description: description || null,
      discountType: discountType.toLowerCase(),
      discountValue: parseFloat(discountValue),
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      minimumAmount: minimumAmount ? parseFloat(minimumAmount) : 0,
              activefrom: processedActiveFrom,
        activeto: processedActiveTo,
      promoType: promoType,
      targetGroup: targetGroup || null,
      targetUserIds: targetUserIds || null,
      isWelcomeCode: promoType === 'WELCOME',
      maxUsagePerUser: maxUsagePerUser,
      globalUsageLimit: globalUsageLimit || null,
      currentUsage: 0,
      isActive: isActive,
      category: category,
      priority: priority,
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

    // Validate promo type if being updated
    if (updateData.promoType && !["GENERAL", "GROUP_SPECIFIC", "USER_SPECIFIC", "WELCOME"].includes(updateData.promoType)) {
      return res.status(400).json({
        error: "Invalid promo type",
        message: "Promo type must be one of: GENERAL, GROUP_SPECIFIC, USER_SPECIFIC, WELCOME"
      });
    }

    // Validate target group for group-specific promo codes
    if (updateData.promoType === 'GROUP_SPECIFIC' && !updateData.targetGroup) {
      return res.status(400).json({
        error: "Target group required",
        message: "Target group is required for GROUP_SPECIFIC promo codes"
      });
    }

    // Validate target user IDs for user-specific promo codes
    if (updateData.promoType === 'USER_SPECIFIC' && (!updateData.targetUserIds || !Array.isArray(updateData.targetUserIds) || updateData.targetUserIds.length === 0)) {
      return res.status(400).json({
        error: "Target user IDs required",
        message: "Target user IDs array is required for USER_SPECIFIC promo codes"
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

    // Validate and process time fields if they're being updated
    let processedUpdateData = { ...updateData };
    
    if (updateData.activeFrom || updateData.activeTo) {
      let processedActiveFrom = updateData.activeFrom;
      let processedActiveTo = updateData.activeTo;
      
      // Get current promo code data to compare dates
      const currentPromoCode = existingCode;
      
      if (updateData.activeFrom) {
        const fromDate = new Date(updateData.activeFrom);
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
      
      if (updateData.activeTo) {
        const toDate = new Date(updateData.activeTo);
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
    
    // Update welcome code flag if promo type is being changed
    if (updateData.promoType) {
      processedUpdateData.isWelcomeCode = updateData.promoType === 'WELCOME';
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

    // Check if promo code has been used
    const { data: usageData, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select("id")
      .eq("promoCodeId", id);

    if (usageError) {
      console.error("Usage check error:", usageError);
      return res.status(500).json({
        error: "Failed to check promo code usage",
        message: "Please try again"
      });
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

// Get all promo codes (admin) with enhanced filtering
exports.getAllPromoCodes = async (req, res) => {
  try {
    console.log("getAllPromoCodes called with query:", req.query);
    
    const { page = 1, limit = 20, search, status, promoType, targetGroup } = req.query;
    const offset = (page - 1) * limit;

    // Build query with enhanced filters
    let query = supabase
      .from("PromoCode")
      .select("*", { count: "exact" });

    // Apply filters
    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (status === "active") {
      query = query.eq("isActive", true);
    } else if (status === "inactive") {
      query = query.eq("isActive", false);
    }

    if (promoType) {
      query = query.eq("promoType", promoType.toUpperCase());
    }

    if (targetGroup) {
      query = query.eq("targetGroup", targetGroup.toUpperCase());
    }

    // Apply pagination and ordering
    query = query.range(offset, offset + limit - 1).order("priority", { ascending: false }).order("code", { ascending: true });

    console.log("Executing query with offset:", offset, "limit:", limit);
    
    const { data: promoCodes, error, count } = await query;

    if (error) {
      console.error("Promo codes fetch error:", error);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: error.message
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
        usageCount: promo.currentUsage || 0,
        isExpired,
        isNotYetActive,
        timeStatus,
        remainingTime,
        remainingGlobalUses: promo.globalUsageLimit ? promo.globalUsageLimit - (promo.currentUsage || 0) : null
      };
    });

    const response = {
      promoCodes: promoCodesWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      },
      filters: {
        status: status || 'all',
        promoType: promoType || 'all',
        targetGroup: targetGroup || 'all'
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
          discountAmount,
          originalAmount,
          finalAmount,
          User (
            id,
            email,
            name,
            memberType,
            studentVerificationStatus
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
    let isActive = promoCode.isActive;
    
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
      isActive = promoCode.isActive;
    } else if (activeFrom && !activeTo) {
      timeStatus = 'active_until_further_notice';
      isActive = promoCode.isActive;
    } else if (!activeFrom && !activeTo) {
      timeStatus = 'always_active';
      isActive = promoCode.isActive;
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
        .or(`and(isActive.eq.true,or(activefrom.is.null,activefrom.lte.${now.toISOString()}),or(activeto.is.null,activeto.gt.${now.toISOString()}))`);
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
    
    const { data: promoCodes, error, count } = await query.order("priority", { ascending: false }).order("code", { ascending: true });
    
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

// Get promo code usage statistics
exports.getPromoCodeUsageStats = async (req, res) => {
  try {
    const { promoCodeId } = req.params;

    if (!promoCodeId) {
      return res.status(400).json({ error: "Promo code ID is required" });
    }

    // Get promo code details
    const { data: promoCode, error: promoError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("id", promoCodeId)
      .single();

    if (promoError || !promoCode) {
      return res.status(404).json({
        error: "Promo code not found",
        message: `No promo code found with ID: ${promoCodeId}`
      });
    }

    // Get usage statistics
    const { data: usageData, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select(`
        *,
        User (
          id,
          email,
          name,
          memberType,
          studentVerificationStatus
        )
      `)
      .eq("promoCodeId", promoCodeId)
      .order("usedAt", { ascending: false });

    if (usageError) {
      console.error("Usage statistics fetch error:", usageError);
      return res.status(500).json({
        error: "Failed to fetch usage statistics",
        details: usageError.message
      });
    }

    // Calculate statistics
    const totalUsage = usageData.length;
    const totalDiscountGiven = usageData.reduce((sum, usage) => sum + parseFloat(usage.discountAmount || 0), 0);
    const totalRevenue = usageData.reduce((sum, usage) => sum + parseFloat(usage.finalAmount || 0), 0);

    // Group by user type
    const usageByUserType = {};
    usageData.forEach(usage => {
      const userType = usage.User?.memberType || 'REGULAR';
      if (!usageByUserType[userType]) {
        usageByUserType[userType] = { count: 0, totalDiscount: 0, totalRevenue: 0 };
      }
      usageByUserType[userType].count++;
      usageByUserType[userType].totalDiscount += parseFloat(usage.discountAmount || 0);
      usageByUserType[userType].totalRevenue += parseFloat(usage.finalAmount || 0);
    });

    // Group by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsage = usageData.filter(usage => new Date(usage.usedAt) >= thirtyDaysAgo);
    const usageByDate = {};
    
    recentUsage.forEach(usage => {
      const date = new Date(usage.usedAt).toISOString().split('T')[0];
      if (!usageByDate[date]) {
        usageByDate[date] = { count: 0, totalDiscount: 0 };
      }
      usageByDate[date].count++;
      usageByDate[date].totalDiscount += parseFloat(usage.discountAmount || 0);
    });

    res.status(200).json({
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        name: promoCode.name,
        promoType: promoCode.promoType,
        targetGroup: promoCode.targetGroup
      },
      statistics: {
        totalUsage,
        totalDiscountGiven,
        totalRevenue,
        remainingUses: promoCode.globalUsageLimit ? promoCode.globalUsageLimit - totalUsage : null,
        averageDiscount: totalUsage > 0 ? totalDiscountGiven / totalUsage : 0
      },
      usageByUserType,
      usageByDate,
      recentUsage: recentUsage.slice(0, 10) // Last 10 usages
    });

  } catch (err) {
    console.error("getPromoCodeUsageStats error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
