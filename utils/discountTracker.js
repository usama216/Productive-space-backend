const supabase = require('../config/database');

/**
 * Discount Tracker Utility
 * 
 * This module provides a unified way to track all discount applications
 * to bookings, including credits, passes, and promo codes.
 * 
 * Discount Types: CREDIT, PASS, PROMO_CODE
 * Action Types: ORIGINAL_BOOKING, RESCHEDULE, EXTENSION, MODIFICATION
 */

/**
 * Log a discount application to the BookingDiscountHistory table
 * 
 * @param {Object} discountData - The discount application data
 * @param {string} discountData.bookingId - The booking ID
 * @param {string} discountData.userId - The user ID (optional)
 * @param {string} discountData.discountType - CREDIT | PASS | PROMO_CODE
 * @param {string} discountData.actionType - ORIGINAL_BOOKING | RESCHEDULE | EXTENSION | MODIFICATION
 * @param {number} discountData.discountAmount - The monetary value of the discount
 * @param {string} discountData.promoCodeId - The promo code ID (if applicable)
 * @param {string} discountData.userPassId - The user pass ID (if applicable)
 * @param {string} discountData.creditId - The credit ID (if applicable)
 * @param {string} discountData.description - Optional description
 * @returns {Promise<Object>} The created discount history record
 */
const logDiscountUsage = async (discountData) => {
  try {
    const {
      bookingId,
      userId,
      discountType,
      actionType,
      discountAmount,
      promoCodeId = null,
      userPassId = null,
      creditId = null,
      description = null
    } = discountData;

    // Validate required fields
    if (!bookingId) {
      throw new Error('bookingId is required');
    }
    if (!discountType || !['CREDIT', 'PASS', 'PROMO_CODE'].includes(discountType)) {
      throw new Error('Valid discountType is required (CREDIT, PASS, or PROMO_CODE)');
    }
    if (!actionType || !['ORIGINAL_BOOKING', 'RESCHEDULE', 'EXTENSION', 'MODIFICATION'].includes(actionType)) {
      throw new Error('Valid actionType is required (ORIGINAL_BOOKING, RESCHEDULE, EXTENSION, or MODIFICATION)');
    }
    if (discountAmount === undefined || discountAmount === null) {
      throw new Error('discountAmount is required');
    }

    console.log('📝 Logging discount usage to BookingDiscountHistory:', {
      bookingId,
      userId,
      discountType,
      actionType,
      discountAmount,
      promoCodeId,
      userPassId,
      creditId,
      description
    });

    const { data, error } = await supabase
      .from('BookingDiscountHistory')
      .insert({
        bookingId,
        userId,
        discountType,
        actionType,
        discountAmount,
        promoCodeId,
        userPassId,
        creditId,
        description
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging discount usage:', error);
      throw error;
    }

    console.log('✅ Discount usage logged successfully:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error in logDiscountUsage:', error);
    throw error;
  }
};

/**
 * Log credit usage for a booking
 * 
 * @param {string} bookingId - The booking ID
 * @param {string} userId - The user ID
 * @param {string} actionType - The action type (ORIGINAL_BOOKING, RESCHEDULE, etc.)
 * @param {number} creditAmount - The amount of credit used
 * @param {string} creditId - The credit ID from usercredits table
 * @param {string} description - Optional description
 */
const logCreditUsage = async (bookingId, userId, actionType, creditAmount, creditId = null, description = null) => {
  return logDiscountUsage({
    bookingId,
    userId,
    discountType: 'CREDIT',
    actionType,
    discountAmount: creditAmount,
    creditId,
    description: description || `Credit applied: $${creditAmount.toFixed(2)}`
  });
};

/**
 * Log pass usage for a booking
 * 
 * @param {string} bookingId - The booking ID
 * @param {string} userId - The user ID
 * @param {string} actionType - The action type (ORIGINAL_BOOKING, RESCHEDULE, etc.)
 * @param {number} passValue - The monetary value of the pass
 * @param {string} userPassId - The user pass ID
 * @param {string} description - Optional description
 */
const logPassUsage = async (bookingId, userId, actionType, passValue, userPassId, description = null) => {
  return logDiscountUsage({
    bookingId,
    userId,
    discountType: 'PASS',
    actionType,
    discountAmount: passValue,
    userPassId,
    description: description || `Pass applied: $${passValue.toFixed(2)}`
  });
};

/**
 * Log promo code usage for a booking
 * 
 * @param {string} bookingId - The booking ID
 * @param {string} userId - The user ID
 * @param {string} actionType - The action type (ORIGINAL_BOOKING, RESCHEDULE, etc.)
 * @param {number} discountAmount - The discount amount
 * @param {string} promoCodeId - The promo code ID
 * @param {string} description - Optional description
 */
const logPromoCodeUsage = async (bookingId, userId, actionType, discountAmount, promoCodeId, description = null) => {
  return logDiscountUsage({
    bookingId,
    userId,
    discountType: 'PROMO_CODE',
    actionType,
    discountAmount,
    promoCodeId,
    description: description || `Promo code applied: $${discountAmount.toFixed(2)}`
  });
};

/**
 * Get discount history for a booking
 * 
 * @param {string} bookingId - The booking ID
 * @returns {Promise<Array>} Array of discount history records
 */
const getBookingDiscountHistory = async (bookingId) => {
  try {
    const { data, error } = await supabase
      .from('BookingDiscountHistory')
      .select('*')
      .eq('bookingId', bookingId)
      .order('appliedAt', { ascending: true });

    if (error) {
      console.error('❌ Error fetching booking discount history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getBookingDiscountHistory:', error);
    return [];
  }
};

/**
 * Get all discount history for a user
 * 
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of discount history records
 */
const getUserDiscountHistory = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('BookingDiscountHistory')
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
      .eq('userId', userId)
      .order('appliedAt', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user discount history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getUserDiscountHistory:', error);
    return [];
  }
};

/**
 * Get discount summary for a booking (aggregated by type and action)
 * 
 * @param {string} bookingId - The booking ID
 * @returns {Promise<Object>} Aggregated discount summary
 */
const getBookingDiscountSummary = async (bookingId) => {
  try {
    const history = await getBookingDiscountHistory(bookingId);
    
    const summary = {
      totalDiscount: 0,
      byType: {
        CREDIT: 0,
        PASS: 0,
        PROMO_CODE: 0
      },
      byAction: {
        ORIGINAL_BOOKING: 0,
        RESCHEDULE: 0,
        EXTENSION: 0,
        MODIFICATION: 0
      },
      details: history
    };

    history.forEach(record => {
      const amount = parseFloat(record.discountAmount);
      summary.totalDiscount += amount;
      summary.byType[record.discountType] += amount;
      summary.byAction[record.actionType] += amount;
    });

    return summary;
  } catch (error) {
    console.error('❌ Error in getBookingDiscountSummary:', error);
    return {
      totalDiscount: 0,
      byType: { CREDIT: 0, PASS: 0, PROMO_CODE: 0 },
      byAction: { ORIGINAL_BOOKING: 0, RESCHEDULE: 0, EXTENSION: 0, MODIFICATION: 0 },
      details: []
    };
  }
};

module.exports = {
  logDiscountUsage,
  logCreditUsage,
  logPassUsage,
  logPromoCodeUsage,
  getBookingDiscountHistory,
  getUserDiscountHistory,
  getBookingDiscountSummary
};

