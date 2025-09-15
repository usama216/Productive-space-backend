const supabase = require("../config/database");

/**
 * 🎯 Handle package usage when booking is confirmed (Count-based system)
 * @param {string} userId - User ID
 * @param {string} packageId - Package ID used
 * @param {number} hoursUsed - Hours used in the booking (for reference only)
 * @param {string} bookingId - Booking ID
 * @param {string} location - Booking location
 * @param {string} startTime - Booking start time
 * @param {string} endTime - Booking end time
 * @returns {Object} - Result of package usage
 */
exports.handlePackageUsage = async (userId, packageId, hoursUsed, bookingId, location, startTime, endTime) => {
  try {
    console.log(`🎯 Handling count-based package usage for user ${userId}, package ${packageId}`);

    // Get user's active package purchases
    const { data: userPackages, error: packageError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          passcount,
          validitydays
        )
      `)
      .eq("userId", userId)
      .eq("packageId", packageId)
      .eq("paymentstatus", "COMPLETED")
      .eq("isactive", true)
      .gte("expiresat", new Date().toISOString()) // Not expired
      .order("activatedat", { ascending: true }); // Use oldest first

    if (packageError) {
      console.error("Error fetching user packages:", packageError);
      return { success: false, error: "Failed to fetch user packages" };
    }

    if (!userPackages || userPackages.length === 0) {
      return { success: false, error: "No active packages found" };
    }

    // Find available passes for this package
    const { data: availablePasses, error: passesError } = await supabase
      .from("UserPass")
      .select("*")
      .eq("packagepurchaseid", userPackages[0].id)
      .eq("status", "ACTIVE")
      .gt("remainingCount", 0) // Has remaining passes
      .order("createdat", { ascending: true }); // Use oldest first

    if (passesError) {
      console.error("Error fetching available passes:", passesError);
      return { success: false, error: "Failed to fetch available passes" };
    }

    if (!availablePasses || availablePasses.length === 0) {
      return { success: false, error: "No available passes found" };
    }

    const packageType = userPackages[0].Package.packagetype;
    const passCount = userPackages[0].Package.passcount;
    
    // Find the first available pass with remaining count
    const passToUse = availablePasses[0];

    if (!passToUse || passToUse.remainingCount <= 0) {
      return { success: false, error: "No remaining passes available" };
    }

    // Decrement the remaining count
    const newRemainingCount = passToUse.remainingCount - 1;
    const isPassFullyUsed = newRemainingCount <= 0;

    // Update the pass with new remaining count
    const updateData = {
      remainingCount: newRemainingCount,
      updatedat: new Date().toISOString()
    };

    // If pass is fully used, mark it as used
    if (isPassFullyUsed) {
      updateData.status = "USED";
      updateData.usedat = new Date().toISOString();
      updateData.bookingid = bookingId;
      updateData.locationid = location;
      updateData.starttime = startTime;
      updateData.endtime = endTime;
    }

    const { error: updatePassError } = await supabase
      .from("UserPass")
      .update(updateData)
      .eq("id", passToUse.id);

    if (updatePassError) {
      console.error("Error updating pass:", updatePassError);
      return { success: false, error: "Failed to update pass" };
    }

    // Create booking pass use record
    const { v4: uuidv4 } = require("uuid");
    const { error: useError } = await supabase
      .from("BookingPassUse")
      .insert([{
        id: uuidv4(),
        bookingId: bookingId,
        userpassid: passToUse.id,
        minutesapplied: 0, // Not used in count-based system
        usedAt: new Date().toISOString()
      }]);

    if (useError) {
      console.error("Error creating booking pass use:", useError);
      // Rollback pass update
      await supabase
        .from("UserPass")
        .update({
          remainingCount: passToUse.remainingCount,
          status: "ACTIVE",
          updatedAt: new Date().toISOString()
        })
        .eq("id", passToUse.id);
      
      return { success: false, error: "Failed to record pass usage" };
    }

    console.log(`✅ Count-based package usage handled successfully:`);
    console.log(`   - Pass used: ${passToUse.id}`);
    console.log(`   - Remaining count: ${newRemainingCount}`);
    console.log(`   - Pass fully used: ${isPassFullyUsed}`);

    return {
      success: true,
      passUsed: passToUse.id,
      passType: passToUse.passType,
      remainingCount: newRemainingCount,
      isPassFullyUsed: isPassFullyUsed,
      packageType: packageType,
      totalPasses: passCount,
      remainingPasses: availablePasses.reduce((sum, pass) => sum + pass.remainingCount, 0) - 1
    };

  } catch (error) {
    console.error("Error in handlePackageUsage:", error);
    return { success: false, error: "Internal server error" };
  }
};

/**
 * 🎯 Calculate excess charges for booking hours
 * @param {number} totalHours - Total booking hours
 * @param {number} packageHours - Hours covered by package
 * @param {number} hourlyRate - Rate per excess hour
 * @returns {number} - Excess charge amount
 */
exports.calculateExcessCharge = (totalHours, packageHours, hourlyRate = 15) => {
  const excessHours = Math.max(0, totalHours - packageHours);
  return excessHours * hourlyRate;
};

/**
 * 🎯 Get user's package usage summary
 * @param {string} userId - User ID
 * @returns {Object} - Package usage summary
 */
exports.getUserPackageUsage = async (userId) => {
  try {
    // Get user's package purchases with pass details
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
      console.error("Error fetching user package usage:", error);
      return { success: false, error: "Failed to fetch package usage" };
    }

    // Process package usage data
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
