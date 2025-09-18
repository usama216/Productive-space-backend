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
      console.log(`❌ No active packages found for user ${userId}, package ${packageId}`);
      return { success: false, error: "No active packages found" };
    }

    console.log(`✅ Found active package:`, userPackages[0].Package.name);

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
    }

    // If no UserPass records exist, create them now
    if (!availablePasses || availablePasses.length === 0) {
      console.log(`🔧 No UserPass records found, creating them now...`);
      
      const { v4: uuidv4 } = require("uuid");
      const userPassData = {
        id: uuidv4(),
        packagepurchaseid: userPackages[0].id,
        userId: userPackages[0].userId,
        passtype: packageType,
        totalCount: passCount,
        remainingCount: passCount,
        status: "ACTIVE",
        hours: 4, // Default hours for count-based passes
        usedat: null,
        bookingid: null,
        locationid: null,
        starttime: null,
        endtime: null,
        expiresAt: userPackages[0].expiresAt,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };

      const { data: insertedPass, error: insertError } = await supabase
        .from("UserPass")
        .insert([userPassData])
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creating UserPass record:", insertError);
        return { success: false, error: "Failed to create UserPass record" };
      }

      console.log(`✅ Created UserPass record:`, insertedPass.id);
      
      // Now use the newly created pass
      const passToUse = insertedPass;
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

      console.log(`✅ UserPass updated successfully! Remaining count: ${newRemainingCount}`);

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

      console.log(`\n🎉 ===== PACKAGE USAGE SUCCESS =====`);
      console.log(`🎉 Pass used: ${result.passUsed}`);
      console.log(`🎉 Remaining count: ${result.remainingCount}`);
      console.log(`🎉 Package type: ${result.packageType}`);
      console.log(`🎉 ===== END PACKAGE USAGE SUCCESS =====\n`);

      return result;
    }

    // If UserPass records exist, use the existing logic
    const passToUse = availablePasses[0];
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

    const { error: updatePassError } = await supabase
      .from("UserPass")
      .update(updateData)
      .eq("id", passToUse.id);

    if (updatePassError) {
      console.error(`❌ Error updating pass:`, updatePassError);
      return { success: false, error: "Failed to update pass: " + updatePassError.message };
    }

    console.log(`✅ UserPass updated successfully! Remaining count: ${newRemainingCount}`);

    const result = {
      success: true,
      passUsed: passToUse.id,
      passType: passToUse.passtype,
      remainingCount: newRemainingCount,
      isPassFullyUsed: isPassFullyUsed,
      packageType: packageType,
      totalPasses: passCount,
      remainingPasses: availablePasses.reduce((sum, pass) => sum + pass.remainingCount, 0) - 1
    };

    console.log(`\n🎉 ===== PACKAGE USAGE SUCCESS =====`);
    console.log(`🎉 Pass used: ${result.passUsed}`);
    console.log(`🎉 Remaining count: ${result.remainingCount}`);
    console.log(`🎉 ===== END PACKAGE USAGE SUCCESS =====\n`);

    return result;

  } catch (error) {
    console.error("Error in handlePackageUsage:", error);
    return { success: false, error: "Internal server error" };
  }
};