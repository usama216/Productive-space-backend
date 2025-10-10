const supabase = require("../config/database");
const { v4: uuidv4 } = require("uuid");

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

    // Get user's active package purchases
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
      .gte("expiresAt", new Date().toISOString()) // Not expired
      .order("activatedAt", { ascending: true }); // Use oldest first

    if (packageError) {
      console.error("❌ Error fetching user packages:", packageError);
      return { success: false, error: "Failed to fetch user packages" };
    }

    if (!userPackages || userPackages.length === 0) {
      return { success: false, error: "No active packages found" };
    }

    const packageType = userPackages[0].Package.packageType;
    const passCount = userPackages[0].Package.passCount;

    // Check if UserPass records exist
    const { data: availablePasses, error: passesError } = await supabase
      .from("UserPass")
      .select("*")
      .eq("packagepurchaseid", userPackages[0].id)
      .eq("status", "ACTIVE")
      .gt("remainingCount", 0)
      .order("createdat", { ascending: true });

    if (passesError) {
      console.error("❌ Error fetching UserPass records:", passesError);
      return { success: false, error: "Failed to fetch UserPass records" };
    }

    // If no UserPass records exist, return error - they should be created at package purchase time
    if (!availablePasses || availablePasses.length === 0) {
      console.error(`❌ No active UserPass records found for package purchase ${userPackages[0].id}`);
      console.error(`❌ UserPass records should be created when package is purchased, not during booking!`);
      return { 
        success: false, 
        error: "No active passes found for this package. UserPass records may not have been created properly during package purchase." 
      };
    }

    // If multiple UserPass records exist (race condition/duplicates), use ALL of them collectively
    // Calculate total remaining across all passes
    const totalRemaining = availablePasses.reduce((sum, pass) => sum + pass.remainingCount, 0);
    
    if (totalRemaining < 1) {
      console.error(`❌ No passes remaining. Total remaining: ${totalRemaining}`);
      return { success: false, error: "No passes remaining" };
    }
    
    // Use the first available pass (or one with highest remaining count)
    const passToUse = availablePasses.sort((a, b) => b.remainingCount - a.remainingCount)[0];
    const newRemainingCount = passToUse.remainingCount - 1;
    const isPassFullyUsed = newRemainingCount <= 0;

    // Update the pass with new remaining count
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

    const { error: updatePassError } = await supabase
      .from("UserPass")
      .update(updateData)
      .eq("id", passToUse.id);

    if (updatePassError) {
      console.error(`❌ Error updating pass:`, updatePassError);
      return { success: false, error: "Failed to update pass: " + updatePassError.message };
    }


    // Create booking pass use record
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
      console.error(`❌ Error creating booking pass use:`, useError);
      // Rollback pass update
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
      passType: passToUse.passtype,
      remainingCount: newRemainingCount,
      isPassFullyUsed: isPassFullyUsed,
      packageType: packageType,
      totalPasses: passCount,
      remainingPasses: newRemainingCount
    };

    return result;

  } catch (error) {
    console.error("Error in handlePackageUsage:", error);
    return { success: false, error: "Internal server error" };
  }
};