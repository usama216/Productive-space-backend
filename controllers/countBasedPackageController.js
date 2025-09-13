// Count-Based Package Controller
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * 🎯 Validate pass usage for count-based system
 * @param {string} userId - User ID
 * @param {string} passType - Type of pass (DAY_PASS, HALF_DAY_PASS)
 * @param {string} startTime - Booking start time
 * @param {string} endTime - Booking end time
 * @param {number} pax - Number of people
 * @returns {Object} - Validation result
 */
exports.validatePassUsage = async (userId, passType, startTime, endTime, pax) => {
  try {
    console.log(`🔍 Validating pass usage for user ${userId}, type: ${passType}, time: ${startTime} to ${endTime}, pax: ${pax}`);

    // Parse times
    const start = new Date(startTime);
    const end = new Date(endTime);
    const startHour = start.getHours();
    const endHour = end.getHours();

    // Define pass restrictions
    const passRestrictions = {
      'DAY_PASS': {
        allowedHours: { start: 8, end: 18 }, // 8am-6pm
        duration: 8, // 8 hours
        name: 'Day Pass'
      },
      'HALF_DAY_PASS': {
        allowedHours: { start: 8, end: 18 }, // 8am-6pm
        duration: 4, // 4 hours
        name: 'Half Day Pass'
      }
    };

    const restriction = passRestrictions[passType];
    if (!restriction) {
      return {
        success: false,
        error: 'Invalid pass type',
        message: 'Pass type not supported'
      };
    }

    // Check time restrictions
    if (startHour < restriction.allowedHours.start || endHour > restriction.allowedHours.end) {
      return {
        success: false,
        error: 'Time restriction violation',
        message: `${restriction.name} can only be used from ${restriction.allowedHours.start}am to ${restriction.allowedHours.end}pm`,
        allowedHours: restriction.allowedHours
      };
    }

    // Get user's available passes
    const { data: userPasses, error: passesError } = await supabase
      .from('UserPass')
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents
        )
      `)
      .eq('userId', userId)
      .eq('passtype', passType)
      .eq('status', 'ACTIVE')
      .gt('remainingQuantity', 0)
      .gte('activeFrom', new Date().toISOString())
      .lte('activeTo', new Date().toISOString())
      .order('createdAt', { ascending: true }); // Use oldest first

    if (passesError) {
      console.error('Error fetching user passes:', passesError);
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to fetch user passes'
      };
    }

    if (!userPasses || userPasses.length === 0) {
      return {
        success: false,
        error: 'No available passes',
        message: `No active ${restriction.name} passes available`,
        availablePasses: 0
      };
    }

    // Find the first available pass
    const availablePass = userPasses[0];
    const remainingQuantity = availablePass.remainingQuantity || 0;

    if (remainingQuantity <= 0) {
      return {
        success: false,
        error: 'No remaining passes',
        message: `No remaining ${restriction.name} passes available`,
        availablePasses: 0
      };
    }

    // Calculate booking duration
    const bookingDuration = (end - start) / (1000 * 60 * 60); // hours

    // Calculate charges
    const originalCharge = bookingDuration * pax * 15; // $15 per hour per person
    let passDiscount = 0;
    let remainingCharge = originalCharge;
    let passUsed = false;

    if (bookingDuration <= restriction.duration) {
      // Full pass coverage - no additional charge
      passDiscount = originalCharge;
      remainingCharge = 0;
      passUsed = true;
    } else {
      // Partial pass coverage - charge for excess hours
      const excessHours = bookingDuration - restriction.duration;
      const excessCharge = excessHours * pax * 15;
      passDiscount = restriction.duration * pax * 15;
      remainingCharge = excessCharge;
      passUsed = true;
    }

    return {
      success: true,
      passId: availablePass.id,
      passType: passType,
      passName: restriction.name,
      originalCharge: originalCharge,
      passDiscount: passDiscount,
      remainingCharge: remainingCharge,
      passUsed: passUsed,
      bookingDuration: bookingDuration,
      passDuration: restriction.duration,
      excessHours: Math.max(0, bookingDuration - restriction.duration),
      remainingQuantity: remainingQuantity - 1, // After using this pass
      allowedHours: restriction.allowedHours
    };

  } catch (error) {
    console.error('Error in validatePassUsage:', error);
    return {
      success: false,
      error: 'Internal error',
      message: 'Failed to validate pass usage'
    };
  }
};

/**
 * 🎯 Apply pass to booking
 * @param {string} userId - User ID
 * @param {string} passId - Pass ID to use
 * @param {string} bookingId - Booking ID
 * @param {string} location - Booking location
 * @param {string} startTime - Booking start time
 * @param {string} endTime - Booking end time
 * @param {number} pax - Number of people
 * @returns {Object} - Result of pass application
 */
exports.applyPassToBooking = async (userId, passId, bookingId, location, startTime, endTime, pax) => {
  try {
    console.log(`🎯 Applying pass ${passId} to booking ${bookingId}`);

    // Get pass details
    const { data: pass, error: passError } = await supabase
      .from('UserPass')
      .select('*')
      .eq('id', passId)
      .eq('userId', userId)
      .eq('status', 'ACTIVE')
      .single();

    if (passError || !pass) {
      return {
        success: false,
        error: 'Pass not found',
        message: 'The specified pass does not exist or is not available'
      };
    }

    if (pass.remainingQuantity <= 0) {
      return {
        success: false,
        error: 'No remaining passes',
        message: 'This pass has no remaining uses'
      };
    }

    // Update pass - decrement remaining quantity
    const { error: updateError } = await supabase
      .from('UserPass')
      .update({
        remainingQuantity: pass.remainingQuantity - 1,
        updatedAt: new Date().toISOString()
      })
      .eq('id', passId);

    if (updateError) {
      console.error('Error updating pass:', updateError);
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to update pass usage'
      };
    }

    // Create booking pass use record
    const { error: useError } = await supabase
      .from('BookingPassUse')
      .insert([{
        id: uuidv4(),
        bookingId: bookingId,
        userPassId: passId,
        minutesApplied: 0, // Not used in count-based system
        usedAt: new Date().toISOString()
      }]);

    if (useError) {
      console.error('Error creating booking pass use:', useError);
      // Rollback pass update
      await supabase
        .from('UserPass')
        .update({
          remainingQuantity: pass.remainingQuantity,
          updatedAt: new Date().toISOString()
        })
        .eq('id', passId);
      
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to record pass usage'
      };
    }

    console.log(`✅ Pass ${passId} successfully applied to booking ${bookingId}`);
    console.log(`   Remaining quantity: ${pass.remainingQuantity - 1}`);

    return {
      success: true,
      passId: passId,
      remainingQuantity: pass.remainingQuantity - 1,
      message: 'Pass successfully applied to booking'
    };

  } catch (error) {
    console.error('Error in applyPassToBooking:', error);
    return {
      success: false,
      error: 'Internal error',
      message: 'Failed to apply pass to booking'
    };
  }
};

/**
 * 🎯 Get user's pass balance
 * @param {string} userId - User ID
 * @returns {Object} - User's pass balances
 */
exports.getUserPassBalance = async (userId) => {
  try {
    console.log(`📊 Getting pass balance for user ${userId}`);

    const { data: userPasses, error } = await supabase
      .from('UserPass')
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents
        )
      `)
      .eq('userId', userId)
      .eq('status', 'ACTIVE')
      .gt('remainingQuantity', 0)
      .gte('activeFrom', new Date().toISOString())
      .lte('activeTo', new Date().toISOString())
      .order('createdAt', { ascending: true });

    if (error) {
      console.error('Error fetching user passes:', error);
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to fetch pass balance'
      };
    }

    // Group passes by type
    const passBalances = {};
    
    userPasses.forEach(pass => {
      const passType = pass.passtype;
      if (!passBalances[passType]) {
        passBalances[passType] = {
          passType: passType,
          totalQuantity: 0,
          remainingQuantity: 0,
          passes: []
        };
      }
      
      passBalances[passType].totalQuantity += pass.totalQuantity || 0;
      passBalances[passType].remainingQuantity += pass.remainingQuantity || 0;
      passBalances[passType].passes.push({
        id: pass.id,
        packageName: pass.Package?.name || 'Unknown Package',
        totalQuantity: pass.totalQuantity || 0,
        remainingQuantity: pass.remainingQuantity || 0,
        activeFrom: pass.activeFrom,
        activeTo: pass.activeTo,
        packageCode: pass.packageCode || `${passType}_${pass.id.substring(0, 8)}`
      });
    });

    return {
      success: true,
      passBalances: Object.values(passBalances),
      totalPasses: userPasses.length,
      totalRemaining: Object.values(passBalances).reduce((sum, balance) => sum + balance.remainingQuantity, 0)
    };

  } catch (error) {
    console.error('Error in getUserPassBalance:', error);
    return {
      success: false,
      error: 'Internal error',
      message: 'Failed to get pass balance'
    };
  }
};

/**
 * 🎯 Create count-based user passes
 * @param {Object} packagePurchase - Package purchase data
 * @returns {Array} - Created user passes
 */
exports.createCountBasedUserPasses = async (packagePurchase) => {
  try {
    console.log(`🎯 Creating count-based user passes for package ${packagePurchase.id}`);

    const packageContents = packagePurchase.Package.packagecontents;
    const userPasses = [];

    // Create day passes
    if (packageContents.dayPasses && packageContents.dayPasses > 0) {
      userPasses.push({
        id: uuidv4(),
        packagepurchaseid: packagePurchase.id,
        userId: packagePurchase.userid,
        passtype: 'DAY_PASS',
        totalQuantity: packageContents.dayPasses,
        remainingQuantity: packageContents.dayPasses,
        status: 'ACTIVE',
        activeFrom: packagePurchase.activatedat || new Date().toISOString(),
        activeTo: packagePurchase.expiresat,
        packageCode: `daypass_${packagePurchase.userid.substring(0, 8)}_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Create half-day passes
    if (packageContents.halfDayPasses && packageContents.halfDayPasses > 0) {
      userPasses.push({
        id: uuidv4(),
        packagepurchaseid: packagePurchase.id,
        userId: packagePurchase.userid,
        passtype: 'HALF_DAY_PASS',
        totalQuantity: packageContents.halfDayPasses,
        remainingQuantity: packageContents.halfDayPasses,
        status: 'ACTIVE',
        activeFrom: packagePurchase.activatedat || new Date().toISOString(),
        activeTo: packagePurchase.expiresat,
        packageCode: `halfdaypass_${packagePurchase.userid.substring(0, 8)}_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Insert all user passes
    if (userPasses.length > 0) {
      const { data: createdPasses, error: insertError } = await supabase
        .from('UserPass')
        .insert(userPasses)
        .select();

      if (insertError) {
        console.error('Error creating user passes:', insertError);
        throw new Error('Failed to create user passes');
      }

      console.log(`✅ Created ${createdPasses.length} count-based user passes`);
      return createdPasses;
    }

    return [];

  } catch (error) {
    console.error('Error in createCountBasedUserPasses:', error);
    throw error;
  }
};
