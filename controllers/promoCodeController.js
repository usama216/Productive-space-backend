const supabase = require("../config/database");
const { v4: uuidv4 } = require('uuid');

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if booking duration meets minimum hours requirement
 */
function checkMinimumHoursRequirement(promoCode, startAt, endAt) {
  if (!promoCode.minimum_hours) {
    return {
      isEligible: true,
      reason: 'No minimum hours requirement'
    };
  }

  const startTime = new Date(startAt);
  const endTime = new Date(endAt);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours

  if (durationHours >= promoCode.minimum_hours) {
    return {
      isEligible: true,
      reason: `Booking duration (${durationHours.toFixed(1)} hours) meets minimum requirement (${promoCode.minimum_hours} hours)`
    };
  } else {
    return {
      isEligible: false,
      reason: `Booking duration (${durationHours.toFixed(1)} hours) does not meet minimum requirement (${promoCode.minimum_hours} hours)`
    };
  }
}

/**
 * Check if a user is eligible for a specific promo code based on business rules
 */
async function checkPromoCodeEligibility(promoCode, userData, userId) {
  try {
    console.log(`Checking eligibility for promo ${promoCode.code} (${promoCode.promoType}/${promoCode.targetGroup})`);
    
    // Check user-specific eligibility
    if (promoCode.promoType === 'USER_SPECIFIC') {
      if (!promoCode.targetUserIds || !promoCode.targetUserIds.includes(userId)) {
        return {
          isEligible: false,
          reason: 'This promo code is not available for your account'
        };
      }
    }
    
    // Check group-specific eligibility
    if (promoCode.promoType === 'GROUP_SPECIFIC') {
      if (promoCode.targetGroup === 'STUDENT') {
        if (userData.studentVerificationStatus !== 'VERIFIED') {
          return {
            isEligible: false,
            reason: 'Student verification required for this promo code'
          };
        }
      } else if (promoCode.targetGroup === 'MEMBER') {
        if (userData.memberType !== 'MEMBER') {
          return {
            isEligible: false,
            reason: 'Premium membership required for this promo code'
          };
        }
      }
    }
    
    // Check welcome code eligibility (only for first booking)
    if (promoCode.promoType === 'WELCOME') {
      // Check if user has ever used ANY promo code (not just this specific one)
      const { data: anyUsageData, error: anyUsageError } = await supabase
        .from("PromoCodeUsage")
        .select("id")
        .eq("userid", userId)
        .limit(1);
      
      if (anyUsageError) {
        console.error("Welcome code usage check error:", anyUsageError);
        return {
          isEligible: false,
          reason: 'Unable to verify welcome code eligibility'
        };
      }
      
      if (anyUsageData && anyUsageData.length > 0) {
        return {
          isEligible: false,
          reason: 'Welcome codes are only available for first-time bookings'
        };
      }
    }
    
    // All checks passed
    return {
      isEligible: true,
      reason: 'Eligible for this promo code'
    };
    
  } catch (err) {
    console.error("Eligibility check error:", err);
    return {
      isEligible: false,
      reason: 'Unable to verify eligibility'
    };
  }
}

/**
 * Calculate discount amount based on promo code type and value
 */
function calculateDiscount(promoCode, bookingAmount) {
  let discountAmount = 0;
  
  if (promoCode.discounttype === "percentage") {
    discountAmount = (parseFloat(bookingAmount) * parseFloat(promoCode.discountvalue)) / 100;
    if (promoCode.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, parseFloat(promoCode.maxDiscountAmount));
    }
  } else if (promoCode.discounttype === "fixed") {
    discountAmount = parseFloat(promoCode.discountvalue);
  }
  
  const finalAmount = Math.max(0, parseFloat(bookingAmount) - discountAmount);
  
  return {
    originalAmount: parseFloat(bookingAmount),
    discountAmount: discountAmount,
    finalAmount: finalAmount
  };
}

/**
 * Record promo code usage in the database
 */
async function recordPromoCodeUsage(promoCodeId, userId, bookingId, discountAmount, originalAmount, finalAmount) {
  try {
    const { error } = await supabase
      .from("PromoCodeUsage")
      .insert([{
        id: uuidv4(),
        promocodeid: promoCodeId,
        userid: userId,
        bookingid: bookingId,
        discountAmount: discountAmount,
        originalAmount: originalAmount,
        finalAmount: finalAmount,
        usedat: new Date().toISOString(),
        createdat: new Date().toISOString()
      }]);

    if (error) {
      console.error("Failed to record promo code usage:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error recording promo code usage:", err);
    return false;
  }
}

/**
 * Update promo code usage count
 */
async function updatePromoCodeUsage(promoCodeId) {
  try {
    // First get current usage
    const { data: promoCode, error: fetchError } = await supabase
      .from("PromoCode")
      .select("currentusage, globalUsageLimit")
      .eq("id", promoCodeId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch promo code:", fetchError);
      return false;
    }

    // Check if we can still use this promo code
    if (promoCode.globalUsageLimit && promoCode.currentusage >= promoCode.globalUsageLimit) {
      console.error("Promo code usage limit exceeded");
      return false;
    }

    // Update usage count
    const { error: updateError } = await supabase
      .from("PromoCode")
      .update({
        currentusage: (promoCode.currentusage || 0) + 1,
        updatedat: new Date().toISOString()
      })
      .eq("id", promoCodeId);

    if (updateError) {
      console.error("Failed to update promo code usage:", updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error updating promo code usage:", err);
    return false;
  }
}

// ==================== USER/CLIENT APIs ====================

/**
 * Apply promo code during booking
 * POST /api/promocode/apply
 */
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode, userId, bookingAmount, startAt, endAt } = req.body;

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
      .is("deletedAt", null) // Exclude soft-deleted promo codes
      .single();

    if (promoError || !promoData) {
      return res.status(404).json({
        error: "Invalid promo code",
        message: "The promo code you entered is not valid or has expired"
      });
    }

    // Get user details for eligibility checking
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id, email, firstName, lastName, memberType, studentVerificationStatus")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        error: "User not found",
        message: "User account not found"
      });
    }

    // Check if promo code is currently active
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

    // Check minimum hours requirement if booking times are provided
    if (startAt && endAt) {
      // Validate that startAt and endAt are valid dates
      const startTime = new Date(startAt);
      const endTime = new Date(endAt);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return res.status(400).json({
          error: "Invalid booking times",
          message: "Please provide valid start and end times"
        });
      }
      
      const hoursCheck = checkMinimumHoursRequirement(promoData, startAt, endAt);
      
      if (!hoursCheck.isEligible) {
        return res.status(400).json({
          error: "Minimum hours not met",
          message: hoursCheck.reason
        });
      }
    }

    // Check eligibility
    let eligibilityCheck = await checkPromoCodeEligibility(promoData, userData, userId);
    
    if (!eligibilityCheck.isEligible) {
      return res.status(400).json({
        error: "Promo code not eligible",
        message: eligibilityCheck.reason
      });
    }

    // Check if user has already used this promo code
    const { data: usageData, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select("*")
      .eq("promocodeid", promoData.id)
      .eq("userid", userId);

    if (usageError) {
      console.error("Usage check error:", usageError);
      return res.status(500).json({
        error: "Failed to check promo code usage",
        message: "Please try again"
      });
    }

    if (usageData && usageData.length >= promoData.maxusageperuser) {
      return res.status(400).json({
        error: "Usage limit reached",
        message: `You have already used this promo code ${promoData.maxusageperuser} times`
      });
    }

    // Check if promo code has reached global usage limit
    if (promoData.globalUsageLimit) {
      const { count: globalUsageCount, error: globalCountError } = await supabase
        .from("PromoCodeUsage")
        .select("*", { count: "exact", head: true })
        .eq("promocodeid", promoData.id);
      
      if (globalCountError) {
        console.error("Global usage count error:", globalCountError);
        return res.status(500).json({
          error: "Failed to check global usage",
          message: "Please try again"
        });
      }
      
      if (globalUsageCount >= promoData.globalUsageLimit) {
        return res.status(400).json({
          error: "Promo code limit reached",
          message: "This promo code has reached its global usage limit"
        });
      }
    }

    // Calculate discount amount
    const calculation = calculateDiscount(promoData, bookingAmount);

    res.status(200).json({
      message: "Promo code applied successfully",
      promoCode: {
        id: promoData.id,
        code: promoData.code,
        name: promoData.name,
        description: promoData.description,
        promoType: promoData.promoType,
        targetGroup: promoData.targetGroup,
        discountType: promoData.discounttype,
        discountValue: promoData.discountvalue,
        maxDiscountAmount: promoData.maxDiscountAmount,
        minimumAmount: promoData.minimumamount,
        minimumHours: promoData.minimum_hours
      },
      calculation: calculation,
      eligibility: {
        isEligible: true,
        reason: eligibilityCheck.reason
      }
    });

  } catch (err) {
    console.error("applyPromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get available promo codes for a user
 * GET /api/promocode/user/:userId/available
 */
exports.getUserAvailablePromos = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get user details for eligibility checking
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id, email, firstName, lastName, memberType, studentVerificationStatus")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        error: "User not found",
        message: "User account not found"
      });
    }

    const now = new Date();

    // Get all active promo codes ordered by priority
    const { data: promoCodes, error: promosError } = await supabase
      .from("PromoCode")
      .select(`
        id,
        code,
        name,
        description,
        discounttype,
        discountvalue,
        maxDiscountAmount,
        minimumamount,
        minimum_hours,
        activefrom,
        activeto,
        promoType,
        targetGroup,
        targetUserIds,
        isWelcomeCode,
        maxusageperuser,
        globalUsageLimit,
        currentusage,
        isactive,
        category,
        priority
      `)
      .eq("isactive", true)
      .is("deletedAt", null) // Exclude soft-deleted promo codes
      .order("priority", { ascending: false });


    if (promosError) {
      console.error("Promo codes fetch error:", promosError);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: promosError.message
      });
    }

    // Filter promo codes by date validity
    const validPromoCodes = promoCodes.filter(promo => {
      if (promo.activefrom && new Date(promo.activefrom) > now) {
        return false; // Not yet active
      }
      if (promo.activeto && new Date(promo.activeto) < now) {
        return false; // Expired
      }
      return true;
    });

    // Get user's usage for each promo code
    const { data: userUsage, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select("promocodeid, usedat")
      .eq("userid", userId);

    if (usageError) {
      console.error("User usage fetch error:", usageError);
      return res.status(500).json({
        error: "Failed to fetch user usage",
        details: usageError.message
      });
    }

    const userUsageData = userUsage || [];

    // Filter and format available promo codes with eligibility checking
    const availablePromos = [];
    
    for (const promo of validPromoCodes) {
      // Check eligibility for this specific promo code
      const eligibilityCheck = await checkPromoCodeEligibility(promo, userData, userId);
      
      if (eligibilityCheck.isEligible) {
        const userUsageCount = userUsageData.filter(usage => usage.promocodeid === promo.id).length;
        
        if (userUsageCount < promo.maxusageperuser) {
          availablePromos.push({
            id: promo.id,
            code: promo.code,
            name: promo.name,
            description: promo.description,
            promoType: promo.promoType,
            targetGroup: promo.targetGroup,
            discountType: promo.discounttype,
            discountValue: promo.discountvalue,
            maxDiscountAmount: promo.maxDiscountAmount,
            minimumAmount: promo.minimumamount,
            minimumHours: promo.minimum_hours,
            activeFrom: promo.activefrom,
            activeTo: promo.activeto,
            maxUsagePerUser: promo.maxusageperuser,
            userUsageCount: userUsageCount,
            remainingUses: promo.maxusageperuser - userUsageCount,
            priority: promo.priority,
            eligibility: {
              isEligible: true,
              reason: eligibilityCheck.reason
            }
          });
        }
      }
    }

    // Sort by priority (highest first) and then by code
    availablePromos.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.code.localeCompare(b.code);
    });

    res.status(200).json({
      availablePromos,
      totalCount: availablePromos.length,
      userInfo: {
        memberType: userData.memberType,
        studentVerificationStatus: userData.studentVerificationStatus,
        firstName: userData.firstName,
        lastName: userData.lastName
      }
    });

  } catch (err) {
    console.error("getUserAvailablePromos error:", err.message);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: err.message
    });
  }
};

/**
 * Get user's used promo codes
 * GET /api/promocode/user/:userId/used
 */
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
          name,
          description,
          promoType,
          targetGroup,
          discounttype,
          discountvalue,
          maxDiscountAmount
        )
      `)
      .eq("userid", userId)
      .order("usedat", { ascending: false });

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

/**
 * Create new promo code
 * POST /api/promocode/admin/create
 */
exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discounttype,
      discountvalue,
      maxDiscountAmount,
      minimumamount,
      minimum_hours, // New field for minimum booking hours
      activefrom,
      activeto,
      promoType = 'GENERAL',
      targetGroup,
      targetUserIds,
      maxusageperuser = 1,
      globalUsageLimit,
      isactive = true,
      category = 'GENERAL',
      priority = 1
    } = req.body;

    // Validate required fields
    if (!code || !name || !discounttype || !discountvalue) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["code", "name", "discounttype", "discountvalue"]
      });
    }

    // Validate discount type
    if (!["percentage", "fixed"].includes(discounttype)) {
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

    // Validate minimum hours if provided
    if (minimum_hours && (parseFloat(minimum_hours) <= 0 || parseFloat(minimum_hours) > 24)) {
      return res.status(400).json({
        error: "Invalid minimum hours",
        message: "Minimum hours must be between 0 and 24"
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
      discounttype: discounttype.toLowerCase(),
      discountvalue: parseFloat(discountvalue),
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      minimumamount: minimumamount ? parseFloat(minimumamount) : 0,
      minimum_hours: minimum_hours ? parseFloat(minimum_hours) : null, // Add minimum hours field
      activefrom: processedActiveFrom,
      activeto: processedActiveTo,
      promoType: promoType,
      targetGroup: targetGroup || null,
      targetUserIds: targetUserIds || null,
      isWelcomeCode: promoType === 'WELCOME',
      maxusageperuser: maxusageperuser,
      globalUsageLimit: globalUsageLimit || null,
      currentusage: 0,
      isactive: isactive,
      category: category,
      priority: priority,
      createdat: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };

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

/**
 * Update promo code
 * PUT /api/promocode/admin/:id
 */
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

    // Update welcome code flag if promo type is being changed
    if (updateData.promoType) {
      updateData.isWelcomeCode = updateData.promoType === 'WELCOME';
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

/**
 * Delete promo code
 * DELETE /api/promocode/admin/:id
 */
exports.deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // Add force parameter

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
      .eq("promocodeid", id);

    if (usageError) {
      console.error("Usage check error:", usageError);
      return res.status(500).json({
        error: "Failed to check promo code usage",
        message: "Please try again"
      });
    }

    // Note: For soft delete, we don't prevent deletion based on usage
    // since we're not actually removing the data from the database
    // The usage data is preserved for historical purposes

    // Soft delete promo code (set deletedAt timestamp)
    const { error } = await supabase
      .from("PromoCode")
      .update({
        deletedAt: new Date().toISOString(),
        isactive: false // Also deactivate it
      })
      .eq("id", id);

    if (error) {
      console.error("Promo code soft deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Prepare response message
    let message = "Promo code deleted successfully";
    if (usageData && usageData.length > 0) {
      message = `Promo code deleted successfully. This promo code had ${usageData.length} usage record(s) which are preserved for historical data.`;
    }

    res.status(200).json({
      message,
      deletedPromoCode: {
        ...existingCode,
        deletedAt: new Date().toISOString(),
        isactive: false
      },
      wasSoftDeleted: true,
      usageCount: usageData ? usageData.length : 0
    });

  } catch (err) {
    console.error("deletePromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Force delete promo code (bypasses usage check)
 * DELETE /api/promocode/admin/:id/force
 */
exports.forceDeletePromoCode = async (req, res) => {
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

    // Get usage count for warning
    const { data: usageData, error: usageError } = await supabase
      .from("PromoCodeUsage")
      .select("id")
      .eq("promocodeid", id);

    if (usageError) {
      console.error("Usage check error:", usageError);
      return res.status(500).json({
        error: "Failed to check promo code usage",
        message: "Please try again"
      });
    }

    // Force delete promo code
    const { error } = await supabase
      .from("PromoCode")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Promo code force deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: `Promo code deleted successfully. Warning: This promo code had ${usageData ? usageData.length : 0} usage record(s) that may now be orphaned.`,
      deletedPromoCode: existingCode,
      wasForceDeleted: true,
      usageCount: usageData ? usageData.length : 0
    });

  } catch (err) {
    console.error("forceDeletePromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Restore soft-deleted promo code
 * PUT /api/promocode/admin/:id/restore
 */
exports.restorePromoCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Promo code ID is required" });
    }

    // Check if promo code exists and is soft-deleted
    const { data: existingCode, error: checkError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("id", id)
      .not("deletedAt", "is", null) // Only soft-deleted codes
      .single();

    if (checkError || !existingCode) {
      return res.status(404).json({
        error: "Soft-deleted promo code not found",
        message: `No soft-deleted promo code found with ID: ${id}`
      });
    }

    // Restore promo code (remove deletedAt timestamp)
    const { error } = await supabase
      .from("PromoCode")
      .update({
        deletedAt: null,
        isactive: true // Also reactivate it
      })
      .eq("id", id);

    if (error) {
      console.error("Promo code restoration error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: "Promo code restored successfully",
      restoredPromoCode: {
        ...existingCode,
        deletedAt: null,
        isactive: true
      }
    });

  } catch (err) {
    console.error("restorePromoCode error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get all promo codes (admin)
 * GET /api/promocode/admin/all
 */
exports.getAllPromoCodes = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, promoType, targetGroup } = req.query;
    const offset = (page - 1) * limit;

    // Build query with filters
    let query = supabase
      .from("PromoCode")
      .select("*", { count: "exact" })
      .is("deletedAt", null); // Exclude soft-deleted promo codes

    // Apply filters
    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (status === "active") {
      query = query.eq("isactive", true);
    } else if (status === "inactive") {
      query = query.eq("isactive", false);
    }

    if (promoType) {
      query = query.eq("promoType", promoType.toUpperCase());
    }

    if (targetGroup) {
      query = query.eq("targetGroup", targetGroup.toUpperCase());
    }

    // Apply pagination and ordering
    query = query.range(offset, offset + limit - 1).order("priority", { ascending: false }).order("code", { ascending: true });
    
    const { data: promoCodes, error, count } = await query;

    if (error) {
      console.error("Promo codes fetch error:", error);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: error.message
      });
    }

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
        usageCount: promo.currentusage || 0,
        isExpired,
        isNotYetActive,
        timeStatus,
        remainingTime,
        remainingGlobalUses: promo.globalUsageLimit ? promo.globalUsageLimit - (promo.currentusage || 0) : null
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

    res.status(200).json(response);

  } catch (err) {
    console.error("getAllPromoCodes error:", err.message);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: err.message
    });
  }
};

/**
 * Get specific promo code details (admin)
 * GET /api/promocode/admin/:id
 */
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
          userid,
          usedat,
          discountAmount,
          originalAmount,
          finalAmount,
          User (
            id,
            email,
            firstName,
            lastName,
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

// ==================== BOOKING INTEGRATION ====================

/**
 * Apply promo code to booking and record usage
 * This function should be called from booking controller
 */
exports.applyPromoCodeToBooking = async (promoCodeId, userId, bookingId, bookingAmount) => {
  try {
    // Get promo code details
    const { data: promoData, error: promoError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("id", promoCodeId)
      .single();

    if (promoError || !promoData) {
      throw new Error("Promo code not found");
    }

    // Calculate discount
    const calculation = calculateDiscount(promoData, bookingAmount);

    // Record usage
    const usageRecorded = await recordPromoCodeUsage(
      promoCodeId,
      userId,
      bookingId,
      calculation.discountAmount,
      calculation.originalAmount,
      calculation.finalAmount
    );

    if (!usageRecorded) {
      throw new Error("Failed to record promo code usage");
    }

    // Update usage count
    const usageUpdated = await updatePromoCodeUsage(promoCodeId);
    if (!usageUpdated) {
      throw new Error("Failed to update promo code usage count");
    }

    return {
      success: true,
      promoCode: promoData,
      calculation: calculation
    };

  } catch (error) {
    console.error("applyPromoCodeToBooking error:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export helper functions for use in other controllers
exports.helperFunctions = {
  checkPromoCodeEligibility,
  checkMinimumHoursRequirement,
  calculateDiscount,
  recordPromoCodeUsage,
  updatePromoCodeUsage
};