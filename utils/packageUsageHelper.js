const supabase = require("../config/database");

/**
 * @param {string} userId 
 * @param {string} packageId 
 * @param {number} hoursUsed 
 * @param {string} bookingId
 * @param {string} location 
 * @param {string} startTime 
 * @param {string} endTime
 * @returns {Object} 
 */
exports.handlePackageUsage = async (userId, packageId, hoursUsed, bookingId, location, startTime, endTime) => {
  try {
    console.log(`\n🔍 ===== PACKAGE USAGE HELPER START =====`);
    console.log(`🔍 User ID: ${userId}`);
    console.log(`🔍 Package ID: ${packageId}`);
    console.log(`🔍 Hours Used: ${hoursUsed}`);
    console.log(`🔍 Booking ID: ${bookingId}`);
    console.log(`🔍 Location: ${location}`);
    console.log(`🔍 Start Time: ${startTime}`);
    console.log(`🔍 End Time: ${endTime}`);

    // Get user's active package purchases
    console.log(`🔍 Fetching user packages...`);
    const { data: userPackages, error: packageError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
         Package (
           id,
           name,
           "packageType",
           "targetRole",
           "passCount",
           "validityDays"
         )
      `)
      .eq("userId", userId)
      .eq("id", packageId)
       .eq("paymentStatus", "COMPLETED")
       .eq("isActive", true)
       .gte("expiresAt", new Date().toISOString()) 
       .order("activatedAt", { ascending: true }); 

    console.log(`🔍 Package query result:`, {
      data: userPackages,
      error: packageError,
      count: userPackages?.length || 0
    });

    if (packageError) {
      return { success: false, error: "Failed to fetch user packages" };
    }

    if (!userPackages || userPackages.length === 0) {
      return { success: false, error: "No active packages found" };
    }

    const { data: availablePasses, error: passesError } = await supabase
      .from("UserPass")
      .select("*")
      .eq("packagepurchaseid", userPackages[0].id)
      .eq("status", "ACTIVE")
      .gt("remainingCount", 0)
      .order("createdat", { ascending: true }); 

    console.log(`🔍 UserPass query result:`, {
      data: availablePasses,
      error: passesError,
      count: availablePasses?.length || 0
    });

    if (passesError) {
      return { success: false, error: "Failed to fetch available passes" };
    }

    if (!availablePasses || availablePasses.length === 0) {
      return { success: false, error: "No available passes found" };
    }

    availablePasses.forEach((pass, index) => {
      console.log(`Pass ${index + 1}:`, {
        id: pass.id,
        remainingCount: pass.remainingCount,
        status: pass.status,
        passType: pass.passtype
      });
    });

     const packageType = userPackages[0].Package.packageType;
     const passCount = userPackages[0].Package.passCount;
    
    const passToUse = availablePasses[0];
    console.log(`Selected pass to use:`, {
      id: passToUse.id,
      remainingCount: passToUse.remainingCount,
      status: passToUse.status
    });

    if (!passToUse || passToUse.remainingCount <= 0) {
      return { success: false, error: "No remaining passes available" };
    }

    const newRemainingCount = passToUse.remainingCount - 1;
    const isPassFullyUsed = newRemainingCount <= 0;

     const updateData = {
       remainingCount: newRemainingCount
     };

    if (isPassFullyUsed) {
      updateData.status = "USED";
      updateData.usedat = new Date().toISOString();
      updateData.bookingid = bookingId;
      updateData.locationid = location;
      updateData.starttime = startTime;
      updateData.endtime = endTime;
    }
    
    const simpleUpdateData = {
      remainingCount: newRemainingCount
    };

     const { createClient } = require('@supabase/supabase-js');
     const freshSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
     
     const { error: updatePassError } = await freshSupabase
       .from("UserPass")
       .update({ remainingCount: newRemainingCount })
       .eq("id", passToUse.id);

     if (updatePassError) {
       
       return { success: false, error: "Failed to update pass: " + updatePassError.message };
     }
     
    const { v4: uuidv4 } = require("uuid");
    const { error: useError } = await supabase
      .from("BookingPassUse")
       .insert([{
         id: uuidv4(),
         bookingId: bookingId,
         userPassId: passToUse.id,
         minutesApplied: 0,
         usedAt: new Date().toISOString()
       }]);

    if (useError) {
     
       await supabase
         .from("UserPass")
         .update({
           remainingCount: passToUse.remainingCount,
           status: "ACTIVE"
         })
         .eq("id", passToUse.id);

      return { success: false, error: "Failed to record pass usage" };
    }

    const result = {
      success: true,
      passUsed: passToUse.id,
      passType: passToUse.passType,
      remainingCount: newRemainingCount,
      isPassFullyUsed: isPassFullyUsed,
      packageType: packageType,
      totalPasses: passCount,
      remainingPasses: availablePasses.reduce((sum, pass) => sum + pass.remainingCount, 0) - 1
    };

    return result;

  } catch (error) {
    return { success: false, error: "Internal server error" };
  }
};

/**
 * @param {number} totalHours 
 * @param {number} packageHours 
 * @param {number} hourlyRate 
 * @returns {number} 
 */
exports.calculateExcessCharge = (totalHours, packageHours, hourlyRate = 15) => {
  const excessHours = Math.max(0, totalHours - packageHours);
  return excessHours * hourlyRate;
};

/**
 
 * @param {string} userId 
 * @returns {Object} 
 */
exports.getUserPackageUsage = async (userId) => {
  try {
    const { data: userPackages, error } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents
        ),
        UserPass (
          id,
          passType,
          hours,
          status,
          usedAt,
          bookingId,
          locationId
        )
      `)
      .eq("userId", userId)
      .eq("paymentstatus", "COMPLETED")
      .eq("isactive", true)
      .order("activatedat", { ascending: false });

    if (error) {
      return { success: false, error: "Failed to fetch package usage" };
    }

    const packageUsage = userPackages.map(purchase => {
      const totalPasses = purchase.UserPass.length;
      const usedPasses = purchase.UserPass.filter(pass => pass.status === "USED").length;
      const activePasses = purchase.UserPass.filter(pass => pass.status === "ACTIVE").length;
      const expiredPasses = purchase.UserPass.filter(pass => pass.status === "EXPIRED").length;

      return {
        purchaseId: purchase.id,
        packageName: purchase.Package.name,
        packageType: purchase.Package.packagetype,
        targetRole: purchase.Package.targetrole,
        totalPasses,
        usedPasses,
        activePasses,
        expiredPasses,
        isExpired: purchase.expiresat ? new Date() > new Date(purchase.expiresat) : false,
        activatedAt: purchase.activatedat,
        expiresAt: purchase.expiresat
      };
    });

    return {
      success: true,
      packageUsage
    };

  } catch (error) {
    console.error("Error in getUserPackageUsage:", error);
    return { success: false, error: "Internal server error" };
  }
};
