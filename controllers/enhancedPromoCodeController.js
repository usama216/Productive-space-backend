const supabase = require("../config/database");

// ==================== TEST ENDPOINT ====================
exports.testEnhancedPromoCodeSystem = async (req, res) => {
  try {
    console.log("Testing Enhanced PromoCode System...");
    
    // Test 1: Check if PromoCode table exists and has new fields
    const { data: tableCheck, error: tableError } = await supabase
      .from("PromoCode")
      .select("id, code, promoType, targetGroup, priority")
      .limit(1);
    
    if (tableError) {
      console.error("PromoCode table check error:", tableError);
      return res.status(500).json({
        error: "PromoCode table not accessible",
        details: tableError.message
      });
    }
    
    // Test 2: Count total records
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
    
    // Test 3: Get sample data with new fields
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
    
    res.status(200).json({
      message: "Enhanced PromoCode System test completed",
      promocodeTable: {
        exists: true,
        totalCount: totalCount || 0,
        sampleData: sampleData || [],
        availableColumns: sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : []
      },
      connectionStatus: "SUCCESS"
    });
    
  } catch (err) {
    console.error("Test endpoint error:", err);
    res.status(500).json({
      error: "Test failed",
      message: err.message
    });
  }
};

// ==================== USER/CLIENT APIs ====================

// Apply promo code during booking with enhanced eligibility checking
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode, userId, bookingAmount } = req.body;

    if (!promoCode || !userId || !bookingAmount) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["promoCode", "userId", "bookingAmount"]
      });
    }

    // Get promo code details with new fields
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

    // Get user details for eligibility checking
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id, email, firstName, lastName, memberType")
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
    if (promoData.minimumAmount && parseFloat(bookingAmount) < parseFloat(promoData.minimumAmount)) {
      return res.status(400).json({
        error: "Minimum amount not met",
        message: `Minimum booking amount of SGD ${promoData.minimumAmount} required for this promo code`
      });
    }

    // Enhanced eligibility checking based on promo code type
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
     let discountAmount = 0;
     let finalAmount = parseFloat(bookingAmount);

     if (promoData.discounttype === "percentage") {
       discountAmount = (parseFloat(bookingAmount) * parseFloat(promoData.discountvalue)) / 100;
       if (promoData.maxDiscountAmount) {
         discountAmount = Math.min(discountAmount, parseFloat(promoData.maxDiscountAmount));
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
         name: promoData.name,
         promoType: promoData.promoType,
         targetGroup: promoData.targetGroup,
         discountType: promoData.discounttype,
         discountValue: promoData.discountvalue,
         maxDiscountAmount: promoData.maxDiscountAmount,
         minimumAmount: promoData.minimumamount
       },
      calculation: {
        originalAmount: parseFloat(bookingAmount),
        discountAmount: discountAmount,
        finalAmount: finalAmount
      },
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

// Get available promo codes for logged-in user with enhanced filtering
exports.getUserAvailablePromos = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("getUserAvailablePromos called for userId:", userId);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get user details for eligibility checking
    console.log("Looking for user with ID:", userId);
    console.log("User ID type:", typeof userId);
    
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id, email, firstName, lastName, memberType")
      .eq("id", userId)
      .single();

    console.log("User query result:", { userData, userError });

    if (userError || !userData) {
      console.error("User not found. Error:", userError);
      console.error("User data:", userData);
      return res.status(404).json({
        error: "User not found",
        message: "User account not found",
        debug: {
          searchedUserId: userId,
          error: userError?.message,
          tableName: "User"
        }
      });
    }

    const now = new Date();

    // Get all active promo codes ordered by priority
    const { data: promoCodes, error: promosError } = await supabase
      .from("PromoCode")
      .select("*")
      .eq("isactive", true)
      .order("priority", { ascending: false });

    if (promosError) {
      console.error("Promo codes fetch error:", promosError);
      return res.status(500).json({ 
        error: "Failed to fetch promo codes",
        details: promosError.message
      });
    }

    console.log("Found", promoCodes?.length || 0, "active promo codes");

    // Filter promo codes by date validity and eligibility
    const validPromoCodes = promoCodes.filter(promo => {
      // Check if promo code is currently active based on dates
      if (promo.activefrom && new Date(promo.activefrom) > now) {
        console.log(`Promo ${promo.code} not yet active: ${promo.activefrom} > ${now}`);
        return false; // Not yet active
      }
      
      if (promo.activeto && new Date(promo.activeto) < now) {
        console.log(`Promo ${promo.code} expired: ${promo.activeto} < ${now}`);
        return false; // Expired
      }
      
      console.log(`Promo ${promo.code} passed date validation`);
      return true;
    });

    console.log("Found", validPromoCodes.length, "valid promo codes after date filtering");

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
    console.log("User usage data:", userUsageData);
    console.log("User usage data length:", userUsageData.length);

    // Filter and format available promo codes with eligibility checking
    const availablePromos = [];
    
    for (const promo of validPromoCodes) {
             // Check eligibility for this specific promo code
       console.log(`Checking eligibility for promo ${promo.code} (${promo.promoType}/${promo.targetGroup})`);
       const eligibilityCheck = await checkPromoCodeEligibility(promo, userData, userId);
       console.log(`Eligibility result for ${promo.code}:`, eligibilityCheck);
       
              if (eligibilityCheck.isEligible) {
                  const userUsageCount = userUsageData.filter(usage => usage.promocodeid === promo.id).length;
         console.log(`Promo ${promo.code}: userUsageCount=${userUsageCount}, maxUsagePerUser=${promo.maxusageperuser}`);
         
         if (userUsageCount < promo.maxusageperuser) {
          availablePromos.push({
            id: promo.id,
            code: promo.code,
            name: promo.name,
            description: promo.description,
            promoType: promo.promoType,
            targetGroup: promo.targetGroup,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            maxDiscountAmount: promo.maxDiscountAmount,
            minimumAmount: promo.minimumAmount,
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

    console.log("Returning", availablePromos.length, "available promo codes");

    res.status(200).json({
      availablePromos,
      totalCount: availablePromos.length,
             userInfo: {
         memberType: userData.memberType,
         firstName: userData.firstName,
         lastName: userData.lastName
       }
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

// ==================== HELPER FUNCTIONS ====================

// Check if a user is eligible for a specific promo code
async function checkPromoCodeEligibility(promoCode, userData, userId) {
  try {
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
         // For now, assume all users can use student codes since we don't have studentVerificationStatus
         // You can add student verification logic later when you have that field
         return {
           isEligible: true,
           reason: 'Student promo code available'
         };
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
       const { data: usageData, error: usageError } = await supabase
         .from("PromoCodeUsage")
         .select("id")
         .eq("userid", userId)
         .eq("promocodeid", promoCode.id);
      
      if (usageError) {
        console.error("Welcome code usage check error:", usageError);
        return {
          isEligible: false,
          reason: 'Unable to verify welcome code eligibility'
        };
      }
      
      if (usageData && usageData.length > 0) {
        return {
          isEligible: false,
          reason: 'Welcome code already used'
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
