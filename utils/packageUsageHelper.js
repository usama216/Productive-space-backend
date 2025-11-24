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
    const packageName = userPackages[0].Package.name;
    const passCount = userPackages[0].Package.passCount;

    // Check if UserPass records exist - first check ALL records for debugging
    const { data: allPasses, error: allPassesError } = await supabase
      .from("UserPass")
      .select("*")
      .eq("packagepurchaseid", userPackages[0].id)
      .order("createdat", { ascending: true });

    console.log(`📦 All UserPass records for package purchase ${userPackages[0].id}:`, allPasses);

    if (allPassesError) {
      console.error("❌ Error fetching UserPass records:", allPassesError);
      return { success: false, error: "Failed to fetch UserPass records" };
    }

    // Filter for active passes with remaining count > 0
    let availablePasses = (allPasses || []).filter(pass => 
      pass.status === "ACTIVE" && (pass.remainingCount || 0) > 0
    );

    console.log(`📦 Active UserPass records with remainingCount > 0:`, availablePasses);

    // If no UserPass records exist, create one for SEMESTER_BUNDLE (same as other packages would have)
    // This handles cases where UserPass wasn't created during package purchase
    if (!availablePasses || availablePasses.length === 0) {
      console.log(`⚠️ No active UserPass found for package purchase ${userPackages[0].id}`);
      console.log(`📦 Creating UserPass for package type: ${packageType}`);
      
      // For SEMESTER_BUNDLE, use "SEMESTER" as passtype (as per payment.js logic)
      const passtypeForDB = packageType === "SEMESTER_BUNDLE" ? "SEMESTER" : packageType;
      
      const newUserPass = {
        id: uuidv4(),
        packagepurchaseid: userPackages[0].id,
        userId: userPackages[0].userId,
        passtype: passtypeForDB,
        totalCount: passCount,
        remainingCount: passCount,
        status: "ACTIVE",
        hours: userPackages[0].Package.hoursAllowed || 4,
        usedat: null,
        bookingid: null,
        locationid: null,
        starttime: null,
        endtime: null,
        expiresAt: userPackages[0].expiresAt || new Date(Date.now() + (userPackages[0].Package.validityDays || 90) * 24 * 60 * 60 * 1000).toISOString(),
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };
      
      const { data: createdPass, error: createError } = await supabase
        .from("UserPass")
        .insert([newUserPass])
        .select()
        .single();
      
      if (createError || !createdPass) {
        console.error(`❌ Error creating UserPass:`, createError);
        return { 
          success: false, 
          error: "Failed to create UserPass record: " + (createError?.message || "Unknown error")
        };
      }
      
      console.log(`✅ UserPass created successfully:`, {
        id: createdPass.id,
        packagepurchaseid: createdPass.packagepurchaseid,
        remainingCount: createdPass.remainingCount,
        totalCount: createdPass.totalCount,
        status: createdPass.status
      });
      
      // Use the newly created pass
      availablePasses = [createdPass];
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
    const oldRemainingCount = passToUse.remainingCount;
    const newRemainingCount = passToUse.remainingCount - 1;
    const isPassFullyUsed = newRemainingCount <= 0;

    console.log(`📦 Decrementing UserPass count:`, {
      userPassId: passToUse.id,
      packagePurchaseId: userPackages[0].id,
      oldCount: oldRemainingCount,
      newCount: newRemainingCount,
      packageType: packageType
    });

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

    console.log(`📦 Updating UserPass with data:`, updateData);

    const { data: updatedPass, error: updatePassError } = await supabase
      .from("UserPass")
      .update(updateData)
      .eq("id", passToUse.id)
      .select()
      .single();

    if (updatePassError) {
      console.error(`❌ Error updating pass:`, updatePassError);
      return { success: false, error: "Failed to update pass: " + updatePassError.message };
    }

    console.log(`✅ UserPass updated successfully:`, {
      userPassId: updatedPass?.id,
      remainingCount: updatedPass?.remainingCount,
      status: updatedPass?.status
    });


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
      packageName: packageName,
      totalPasses: passCount,
      remainingPasses: newRemainingCount
    };

    return result;

  } catch (error) {
    console.error("Error in handlePackageUsage:", error);
    return { success: false, error: "Internal server error" };
  }
};