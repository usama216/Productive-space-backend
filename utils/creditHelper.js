const supabase = require('../config/database');
const { logCreditUsage } = require('./discountTracker');

// Get user's available credits (active and not expired)
const getUserAvailableCredits = async (userid) => {
  try {
    const now = new Date().toISOString();
    
    const { data: credits, error } = await supabase
      .from('usercredits')
      .select('*')
      .eq('userid', userid)
      .eq('status', 'ACTIVE')
      .gt('expiresat', now)
      .order('expiresat', { ascending: true });

    if (error) {
      console.error('❌ Error fetching user credits:', error);
      return [];
    }

    return credits || [];
  } catch (error) {
    console.error('❌ Error in getUserAvailableCredits:', error);
    return [];
  }
};

// Calculate total available credit amount
const getTotalAvailableCredit = async (userid) => {
  try {
    const credits = await getUserAvailableCredits(userid);
    return credits.reduce((total, credit) => total + parseFloat(credit.amount), 0);
  } catch (error) {
    console.error('❌ Error in getTotalAvailableCredit:', error);
    return 0;
  }
};

// Use credits for a booking
const useCreditsForBooking = async (userid, bookingid, amountToUse, actionType = 'ORIGINAL_BOOKING') => {
  try {
    console.log('💳 Using credits for booking:', { userid, bookingid, amountToUse, actionType });

    const credits = await getUserAvailableCredits(userid);
    let remainingAmount = amountToUse;
    const creditUsages = [];

    for (const credit of credits) {
      if (remainingAmount <= 0) break;

      const creditamount = parseFloat(credit.amount);
      const useAmount = Math.min(remainingAmount, creditamount);

      // Create credit usage record
      const { data: creditUsage, error: usageError } = await supabase
        .from('creditusage')
        .insert({
          userid,
          creditid: credit.id,
          bookingid,
          amountused: useAmount
        })
        .select()
        .single();

      if (usageError) {
        console.error('❌ Error creating credit usage:', usageError);
        throw new Error('Failed to create credit usage');
      }

      creditUsages.push(creditUsage);

      // Update credit amount
      const newAmount = creditamount - useAmount;
      if (newAmount > 0) {
        const { error: updateError } = await supabase
          .from('usercredits')
          .update({ amount: newAmount })
          .eq('id', credit.id);

        if (updateError) {
          console.error('❌ Error updating credit amount:', updateError);
          throw new Error('Failed to update credit amount');
        }
      } else {
        // Mark credit as used if fully consumed
        const { error: updateError } = await supabase
          .from('usercredits')
          .update({ status: 'USED' })
          .eq('id', credit.id);

        if (updateError) {
          console.error('❌ Error marking credit as used:', updateError);
          throw new Error('Failed to mark credit as used');
        }
      }

      remainingAmount -= useAmount;
    }

    const totalUsed = amountToUse - remainingAmount;
    console.log('✅ Credits used successfully:', { totalUsed, remainingAmount });

    // Log to unified BookingDiscountHistory
    if (totalUsed > 0) {
      try {
        await logCreditUsage(
          bookingid,
          userid,
          actionType,
          totalUsed,
          creditUsages.length > 0 ? creditUsages[0].creditid : null,
          `Credits applied: $${totalUsed.toFixed(2)} (${actionType})`
        );
      } catch (logError) {
        console.error('⚠️ Warning: Failed to log credit usage to BookingDiscountHistory:', logError);
        // Don't fail the entire operation if logging fails
      }
    }

    return {
      totalUsed,
      remainingAmount,
      creditUsages
    };
  } catch (error) {
    console.error('❌ Error in useCreditsForBooking:', error);
    throw error;
  }
};

// Calculate payment required after using credits
const calculatePaymentAfterCredits = async (userid, bookingAmount) => {
  try {
    const totalCredit = await getTotalAvailableCredit(userid);
    const paymentRequired = Math.max(0, bookingAmount - totalCredit);
    
    return {
      bookingAmount,
      availableCredit: totalCredit,
      paymentRequired,
      canUseCredit: totalCredit > 0
    };
  } catch (error) {
    console.error('❌ Error in calculatePaymentAfterCredits:', error);
    return {
      bookingAmount,
      availableCredit: 0,
      paymentRequired: bookingAmount,
      canUseCredit: false
    };
  }
};

// Clean up expired credits (run daily)
const cleanupExpiredCredits = async () => {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('usercredits')
      .update({ status: 'EXPIRED' })
      .eq('status', 'ACTIVE')
      .lt('expiresat', now);

    if (error) {
      console.error('❌ Error cleaning up expired credits:', error);
      return false;
    }

    console.log('✅ Expired credits cleaned up successfully');
    return true;
  } catch (error) {
    console.error('❌ Error in cleanupExpiredCredits:', error);
    return false;
  }
};

// Get credit usage history for a user
const getCreditUsageHistory = async (userid) => {
  try {
    const { data: usage, error } = await supabase
      .from('creditusage')
      .select(`
        *,
        Booking (
          bookingRef,
          startAt,
          endAt,
          location,
          totalAmount
        )
      `)
      .eq('userid', userid)
      .order('usedat', { ascending: false });

    if (error) {
      console.error('❌ Error fetching credit usage history:', error);
      return [];
    }

    return usage || [];
  } catch (error) {
    console.error('❌ Error in getCreditUsageHistory:', error);
    return [];
  }
};

module.exports = {
  getUserAvailableCredits,
  getTotalAvailableCredit,
  useCreditsForBooking,
  calculatePaymentAfterCredits,
  cleanupExpiredCredits,
  getCreditUsageHistory
};
