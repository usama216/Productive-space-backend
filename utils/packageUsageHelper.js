const supabase = require("../config/database");

/**
 * 🎯 Handle package usage when booking is confirmed
 * @param {string} userId - User ID
 * @param {string} packageId - Package ID used
 * @param {number} hoursUsed - Hours used in the booking
 * @param {string} bookingId - Booking ID
 * @param {string} location - Booking location
 * @param {string} startTime - Booking start time
 * @param {string} endTime - Booking end time
 * @returns {Object} - Result of package usage
 */
exports.handlePackageUsage = async (userId, packageId, hoursUsed, bookingId, location, startTime, endTime) => {
  try {
    console.log(`🎯 Handling package usage for user ${userId}, package ${packageId}, hours ${hoursUsed}`);

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
          packagecontents,
          validitydays
        )
      `)
      .eq("userid", userId)
      .eq("packageid", packageId)
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
      .order("createdat", { ascending: true }); // Use oldest first

    if (passesError) {
      console.error("Error fetching available passes:", passesError);
      return { success: false, error: "Failed to fetch available passes" };
    }

    if (!availablePasses || availablePasses.length === 0) {
      return { success: false, error: "No available passes found" };
    }

    const packageContents = userPackages[0].Package.packagecontents;
    const packageType = userPackages[0].Package.packagetype;
    
    // Determine which pass to use based on package type and hours
    let passToUse = null;
    let hoursCovered = 0;
    let excessHours = 0;

    if (packageType === "HALF_DAY") {
      // For half-day packages, use half-day passes
      passToUse = availablePasses.find(pass => pass.passtype === "HALF_DAY");
      if (passToUse) {
        hoursCovered = Math.min(hoursUsed, passToUse.hours);
        excessHours = Math.max(0, hoursUsed - passToUse.hours);
      }
    } else if (packageType === "FULL_DAY") {
      // For full-day packages, use full-day passes
      passToUse = availablePasses.find(pass => pass.passtype === "FULL_DAY");
      if (passToUse) {
        hoursCovered = Math.min(hoursUsed, passToUse.hours);
        excessHours = Math.max(0, hoursUsed - passToUse.hours);
      }
    } else if (packageType === "SEMESTER_BUNDLE") {
      // For semester packages, use semester passes
      passToUse = availablePasses.find(pass => pass.passtype === "SEMESTER");
      if (passToUse) {
        hoursCovered = Math.min(hoursUsed, passToUse.hours);
        excessHours = Math.max(0, hoursUsed - passToUse.hours);
      }
    }

    if (!passToUse) {
      return { success: false, error: "No suitable pass available for this package type" };
    }

    // Mark the pass as used
    const { error: updatePassError } = await supabase
      .from("UserPass")
      .update({
        status: "USED",
        usedat: new Date().toISOString(),
        bookingid: bookingId,
        locationid: location,
        starttime: startTime,
        endtime: endTime,
        updatedat: new Date().toISOString()
      })
      .eq("id", passToUse.id);

    if (updatePassError) {
      console.error("Error updating pass status:", updatePassError);
      return { success: false, error: "Failed to update pass status" };
    }

    // Calculate excess charges if applicable
    let excessCharge = 0;
    if (excessHours > 0) {
      // Calculate excess charge based on hourly rate
      // You can adjust this rate as needed
      const hourlyRate = 15; // SGD per hour for excess
      excessCharge = excessHours * hourlyRate;
    }

    console.log(`✅ Package usage handled successfully:`);
    console.log(`   - Pass used: ${passToUse.id}`);
    console.log(`   - Hours covered: ${hoursCovered}`);
    console.log(`   - Excess hours: ${excessHours}`);
    console.log(`   - Excess charge: $${excessCharge}`);

    return {
      success: true,
      passUsed: passToUse.id,
      hoursCovered: hoursCovered,
      excessHours: excessHours,
      excessCharge: excessCharge,
      packageType: packageType,
      remainingPasses: availablePasses.length - 1
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
          passtype,
          hours,
          status,
          usedat,
          bookingid,
          locationid
        )
      `)
      .eq("userid", userId)
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
