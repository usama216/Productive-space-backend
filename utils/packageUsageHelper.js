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
       .gte("expiresAt", new Date().toISOString()) // Not expired
       .order("activatedAt", { ascending: true }); // Use oldest first

    console.log(`🔍 Package query result:`, {
      data: userPackages,
      error: packageError,
      count: userPackages?.length || 0
    });

    if (packageError) {
      console.error("❌ Error fetching user packages:", packageError);
      return { success: false, error: "Failed to fetch user packages" };
    }

    if (!userPackages || userPackages.length === 0) {
      console.log(`❌ No active packages found for user ${userId}, package ${packageId}`);
      return { success: false, error: "No active packages found" };
    }

    console.log(`✅ Found ${userPackages.length} active package(s)`);
    console.log(`🔍 Package details:`, JSON.stringify(userPackages[0], null, 2));

    // Find available passes for this package
    console.log(`🔍 Fetching available passes for package purchase ID: ${userPackages[0].id}`);
    const { data: availablePasses, error: passesError } = await supabase
      .from("UserPass")
      .select("*")
      .eq("packagepurchaseid", userPackages[0].id)
      .eq("status", "ACTIVE")
      .gt("remainingCount", 0) // Has remaining passes
      .order("createdat", { ascending: true }); // Use oldest first

    console.log(`🔍 UserPass query result:`, {
      data: availablePasses,
      error: passesError,
      count: availablePasses?.length || 0
    });

    if (passesError) {
      console.error("❌ Error fetching available passes:", passesError);
      return { success: false, error: "Failed to fetch available passes" };
    }

    if (!availablePasses || availablePasses.length === 0) {
      console.log(`❌ No available passes found for package purchase ${userPackages[0].id}`);
      return { success: false, error: "No available passes found" };
    }

    console.log(`✅ Found ${availablePasses.length} available pass(es)`);
    availablePasses.forEach((pass, index) => {
      console.log(`🔍 Pass ${index + 1}:`, {
        id: pass.id,
        remainingCount: pass.remainingCount,
        status: pass.status,
        passType: pass.passtype
      });
    });

     const packageType = userPackages[0].Package.packageType;
     const passCount = userPackages[0].Package.passCount;
    
    // Find the first available pass with remaining count
    const passToUse = availablePasses[0];
    console.log(`🔍 Selected pass to use:`, {
      id: passToUse.id,
      remainingCount: passToUse.remainingCount,
      status: passToUse.status
    });

    if (!passToUse || passToUse.remainingCount <= 0) {
      console.log(`❌ No remaining passes available in selected pass`);
      return { success: false, error: "No remaining passes available" };
    }

    // Decrement the remaining count
    const newRemainingCount = passToUse.remainingCount - 1;
    const isPassFullyUsed = newRemainingCount <= 0;

    console.log(`🔍 ===== UPDATING USERPASS =====`);
    console.log(`🔍 Current remaining count: ${passToUse.remainingCount}`);
    console.log(`🔍 New remaining count: ${newRemainingCount}`);
    console.log(`🔍 Is pass fully used: ${isPassFullyUsed}`);

     // Update the pass with new remaining count
     const updateData = {
       remainingCount: newRemainingCount
     };

    // If pass is fully used, mark it as used
    if (isPassFullyUsed) {
      updateData.status = "USED";
      updateData.usedat = new Date().toISOString();
      updateData.bookingid = bookingId;
      updateData.locationid = location;
      updateData.starttime = startTime;
      updateData.endtime = endTime;
      console.log(`🔍 Pass will be marked as USED`);
    }
    
    // For now, let's only update remainingCount to avoid the updatedAt error
    const simpleUpdateData = {
      remainingCount: newRemainingCount
    };

     console.log(`🔍 Update data:`, JSON.stringify(updateData, null, 2));
     console.log(`🔍 Simple update data:`, JSON.stringify(simpleUpdateData, null, 2));
     console.log(`🔍 Pass ID to update: ${passToUse.id}`);
     
     // Try a simple update first
     console.log(`🔍 Attempting to update UserPass record: ${passToUse.id}`);
     console.log(`🔍 New remaining count: ${newRemainingCount}`);
     
     // Try using a fresh Supabase client instance
     const { createClient } = require('@supabase/supabase-js');
     const freshSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
     
     console.log(`🔍 Using fresh Supabase client for update...`);
     const { error: updatePassError } = await freshSupabase
       .from("UserPass")
       .update({ remainingCount: newRemainingCount })
       .eq("id", passToUse.id);

     if (updatePassError) {
       console.error(`❌ Error updating pass:`, updatePassError);
       console.error(`❌ Update error details:`, JSON.stringify(updatePassError, null, 2));
       return { success: false, error: "Failed to update pass: " + updatePassError.message };
     }
     
     console.log(`✅ UserPass updated successfully!`);
     console.log(`✅ Pass ID: ${passToUse.id}`);
     console.log(`✅ New remaining count: ${newRemainingCount}`);

    // Create booking pass use record
    console.log(`🔍 Creating BookingPassUse record...`);
    const { v4: uuidv4 } = require("uuid");
    const { error: useError } = await supabase
      .from("BookingPassUse")
       .insert([{
         id: uuidv4(),
         bookingId: bookingId,
         userPassId: passToUse.id,
         minutesApplied: 0, // Not used in count-based system
         usedAt: new Date().toISOString()
       }]);

    if (useError) {
      console.error(`❌ Error creating booking pass use:`, useError);
      console.error(`❌ Use error details:`, JSON.stringify(useError, null, 2));
      // Rollback pass update
      console.log(`🔍 Rolling back pass update...`);
       await supabase
         .from("UserPass")
         .update({
           remainingCount: passToUse.remainingCount,
           status: "ACTIVE"
         })
         .eq("id", passToUse.id);

      return { success: false, error: "Failed to record pass usage" };
    }

    console.log(`✅ BookingPassUse record created successfully`);

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

    console.log(`\n🎉 ===== PACKAGE USAGE SUCCESS =====`);
    console.log(`🎉 Pass used: ${result.passUsed}`);
    console.log(`🎉 Remaining count: ${result.remainingCount}`);
    console.log(`🎉 Pass fully used: ${result.isPassFullyUsed}`);
    console.log(`🎉 Package type: ${result.packageType}`);
    console.log(`🎉 Total passes: ${result.totalPasses}`);
    console.log(`🎉 Remaining passes: ${result.remainingPasses}`);
    console.log(`🎉 ===== END PACKAGE USAGE SUCCESS =====\n`);

    return result;

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
