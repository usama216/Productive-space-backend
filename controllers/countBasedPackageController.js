const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { logPassUsage } = require('../utils/discountTracker');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.validatePassUsage = async (userId, passType, startTime, endTime, pax) => {
  try {
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const startHour = start.getHours();
    const endHour = end.getHours();

    // Get dynamic hours from package configuration
    const { data: userPass, error: passError } = await supabase
      .from('UserPass')
      .select(`
        *,
        PackagePurchase (
          Package (
            hoursAllowed
          )
        )
      `)
      .eq('userId', userId)
      .eq('passtype', passType)
      .eq('status', 'ACTIVE')
      .gt('remainingQuantity', 0)
      .single();

    if (passError || !userPass) {
      return {
        success: false,
        error: 'No active pass found',
        message: 'No active pass available for this user'
      };
    }

    const hoursAllowed = userPass.PackagePurchase?.Package?.hoursAllowed;
    if (!hoursAllowed) {
      return {
        success: false,
        error: 'Package configuration not found',
        message: 'Package hours configuration is missing'
      };
    }

    const passRestrictions = {
      'DAY_PASS': {
        allowedHours: { start: 8, end: 18 },
        duration: hoursAllowed,
        name: 'Day Pass'
      },
      'HALF_DAY_PASS': {
        allowedHours: { start: 8, end: 18 }, 
        duration: hoursAllowed, 
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

    if (startHour < restriction.allowedHours.start || endHour > restriction.allowedHours.end) {
      return {
        success: false,
        error: 'Time restriction violation',
        message: `${restriction.name} can only be used from ${restriction.allowedHours.start}am to ${restriction.allowedHours.end}pm`,
        allowedHours: restriction.allowedHours
      };
    }

    // Use the userPass data we already fetched
    const userPasses = [userPass];
    const availablePass = userPass;
    const remainingQuantity = availablePass.remainingQuantity || 0;

    if (remainingQuantity <= 0) {
      return {
        success: false,
        error: 'No remaining passes',
        message: `No remaining ${restriction.name} passes available`,
        availablePasses: 0
      };
    }

    const bookingDuration = (end - start) / (1000 * 60 * 60);

    const originalCharge = bookingDuration * pax * 15;
    let passDiscount = 0;
    let remainingCharge = originalCharge;
    let passUsed = false;

    if (bookingDuration <= restriction.duration) {
      passDiscount = originalCharge;
      remainingCharge = 0;
      passUsed = true;
    } else {
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
      remainingQuantity: remainingQuantity - 1,
      allowedHours: restriction.allowedHours
    };

  } catch (error) {
    return {
      success: false,
      error: 'Internal error',
      message: 'Failed to validate pass usage'
    };
  }
};


exports.applyPassToBooking = async (userId, passId, bookingId, location, startTime, endTime, pax, actionType = 'ORIGINAL_BOOKING', passValue = 0) => {
  try {
   
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

    const { error: updateError } = await supabase
      .from('UserPass')
      .update({
        remainingQuantity: pass.remainingQuantity - 1,
        updatedAt: new Date().toISOString()
      })
      .eq('id', passId);

    if (updateError) {
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to update pass usage'
      };
    }

    const { error: useError } = await supabase
      .from('BookingPassUse')
      .insert([{
        id: uuidv4(),
        bookingId: bookingId,
        userPassId: passId,
        minutesApplied: 0,
        usedAt: new Date().toISOString()
      }]);

    if (useError) {
    
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

    // Log pass usage to BookingDiscountHistory for unified tracking
    try {
      if (passValue > 0) {
        await logPassUsage(
          bookingId,
          userId,
          actionType,
          passValue,
          passId,
          `Pass applied: ${pass.passtype || 'Pass'} (${actionType})`
        );
      }
    } catch (logError) {
      console.error('⚠️ Warning: Failed to log pass usage to BookingDiscountHistory:', logError);
      // Don't fail the entire operation if logging fails
    }

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


exports.getUserPassBalance = async (userId) => {
  try {
 
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
      return {
        success: false,
        error: 'Database error',
        message: 'Failed to fetch pass balance'
      };
    }

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
    return {
      success: false,
      error: 'Internal error',
      message: 'Failed to get pass balance'
    };
  }
};


exports.createCountBasedUserPasses = async (packagePurchase) => {
  try {

    const packageContents = packagePurchase.Package.packagecontents;
    const userPasses = [];

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

    if (userPasses.length > 0) {
      const { data: createdPasses, error: insertError } = await supabase
        .from('UserPass')
        .insert(userPasses)
        .select();

      if (insertError) {
        throw new Error('Failed to create user passes');
      }

      return createdPasses;
    }

    return [];

  } catch (error) {
    throw error;
  }
};
