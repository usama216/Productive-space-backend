const supabase = require('../config/database');

/**
 * Activity Types Constants
 */
const ACTIVITY_TYPES = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PROMO_APPLIED: 'PROMO_APPLIED',
  CREDIT_USED: 'CREDIT_USED',
  PACKAGE_USED: 'PACKAGE_USED',
  RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
  RESCHEDULE_APPROVED: 'RESCHEDULE_APPROVED',
  RESCHEDULE_REJECTED: 'RESCHEDULE_REJECTED',
  EXTEND_REQUESTED: 'EXTEND_REQUESTED',
  EXTEND_APPROVED: 'EXTEND_APPROVED',
  EXTEND_REJECTED: 'EXTEND_REJECTED',
  DOOR_ACCESS: 'DOOR_ACCESS',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  REFUND_REJECTED: 'REFUND_REJECTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_COMPLETED: 'BOOKING_COMPLETED',
  SEAT_CHANGED: 'SEAT_CHANGED',
  NOTES_ADDED: 'NOTES_ADDED',
  BOOKING_UPDATED: 'BOOKING_UPDATED'
};

/**
 * Log a booking activity
 * @param {Object} params - Activity parameters
 * @param {number} params.bookingId - Booking database ID
 * @param {string} params.bookingRef - Booking reference number (e.g., BOOK12345)
 * @param {string} params.activityType - Type of activity (use ACTIVITY_TYPES constants)
 * @param {string} params.activityTitle - Short title
 * @param {string} params.activityDescription - Detailed description
 * @param {Object} params.metadata - Additional data (flexible JSON)
 * @param {string} params.userId - User ID who performed the action
 * @param {string} params.userName - User's full name
 * @param {string} params.userEmail - User's email
 * @param {number} params.amount - Amount involved (if applicable)
 * @param {string} params.oldValue - Previous value (for updates)
 * @param {string} params.newValue - New value (for updates)
 * @returns {Promise<Object>} Result of the logging operation
 */
async function logBookingActivity({
  bookingId,
  bookingRef,
  activityType,
  activityTitle,
  activityDescription = null,
  metadata = null,
  userId = null,
  userName = null,
  userEmail = null,
  amount = null,
  oldValue = null,
  newValue = null
}) {
  try {
    // Validate required fields
    if (!bookingId || !bookingRef || !activityType || !activityTitle) {
      throw new Error('bookingId, bookingRef, activityType, and activityTitle are required');
    }

    const { data, error } = await supabase
      .from('BookingActivityLog')
      .insert([
        {
          bookingId,
          bookingRef,
          activityType,
          activityTitle,
          activityDescription,
          metadata,
          userId,
          userName,
          userEmail,
          amount,
          oldValue,
          newValue,
          createdAt: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error logging booking activity:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in logBookingActivity:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all activities for a booking
 * @param {string} bookingRef - Booking reference number
 * @returns {Promise<Array>} Array of activities
 */
async function getBookingActivities(bookingRef) {
  try {
    const { data, error } = await supabase
      .from('BookingActivityLog')
      .select('*')
      .eq('bookingRef', bookingRef)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching booking activities:', error);
      return { success: false, error };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getBookingActivities:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get activities by booking ID
 * @param {number} bookingId - Booking database ID
 * @returns {Promise<Array>} Array of activities
 */
async function getBookingActivitiesById(bookingId) {
  try {
    const { data, error } = await supabase
      .from('BookingActivityLog')
      .select('*')
      .eq('bookingId', bookingId)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching booking activities by ID:', error);
      return { success: false, error };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getBookingActivitiesById:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get comprehensive booking details with all related data
 * @param {string} bookingRef - Booking reference number
 * @returns {Promise<Object>} Complete booking details
 */
async function getComprehensiveBookingDetails(bookingRef) {
  try {
    // Fetch main booking
    const { data: booking, error: bookingError } = await supabase
      .from('Booking')
      .select('*')
      .eq('bookingRef', bookingRef)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Fetch activity log
    const activities = await getBookingActivities(bookingRef);

    // Fetch reschedule requests
    const { data: reschedules } = await supabase
      .from('RescheduleRequest')
      .select('*')
      .eq('bookingRef', bookingRef)
      .order('createdAt', { ascending: false });

    // Fetch refund requests
    const { data: refunds } = await supabase
      .from('RefundRequest')
      .select('*')
      .eq('bookingId', booking.id)
      .order('createdAt', { ascending: false });

    // Fetch door access logs
    const { data: doorAccess } = await supabase
      .from('DoorAccessLog')
      .select('*')
      .eq('booking_ref', bookingRef)
      .order('excute_at', { ascending: false });

    // Fetch user details
    const { data: user } = await supabase
      .from('User')
      .select('id, email, firstName, lastName, memberType')
      .eq('id', booking.userId)
      .single();

    // Fetch payment details with fees (bookingRef in Payment table stores booking.id, not bookingRef)
    const { data: payments } = await supabase
      .from('Payment')
      .select('*')
      .eq('bookingRef', booking.id)
      .order('createdAt', { ascending: true });

    // Calculate detailed payment breakdown
    let totalCardFee = 0;
    let totalPayNowFee = 0;
    let totalPaid = 0;
    let paymentBreakdown = [];
    
    try {
      const { getPaymentSettings } = require('./paymentFeeHelper');
      const feeSettings = await getPaymentSettings();
      const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
      const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;

      console.log('💰 Processing payments for audit:', payments ? payments.length : 0);

      paymentBreakdown = (payments || []).map(payment => {
        const amount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
        const method = payment.paymentMethod || '';
        
        const isCard = method && (method.toLowerCase().includes('card') || method.toLowerCase().includes('credit'));
        const isPayNow = method && (method.toLowerCase().includes('paynow') || method.toLowerCase().includes('pay_now'));
        
        let fee = 0;
        let subtotal = amount;
        
        if (isCard) {
          const multiplier = 1 + (cardFeePercentage / 100);
          subtotal = amount / multiplier;
          fee = amount - subtotal;
          totalCardFee += fee;
        } else if (isPayNow && amount < 10) {
          fee = paynowFeeAmount;
          subtotal = amount - fee;
          totalPayNowFee += fee;
        }
        
        totalPaid += amount;
        
        return {
          id: payment.id,
          amount: amount,
          subtotal: Math.round(subtotal * 100) / 100,
          fee: Math.round(fee * 100) / 100,
          method: method,
          status: payment.status,
          createdAt: payment.createdAt
        };
      });
      
      console.log('💰 Calculated fees:', { totalCardFee, totalPayNowFee, totalPaid });
    } catch (feeError) {
      console.error('Error calculating payment fees:', feeError);
    }

    // Calculate discount breakdown
    const promoDiscount = parseFloat(booking.discountamount || 0);
    const packageDiscount = parseFloat(booking.packageDiscountAmount || 0);
    const creditUsed = parseFloat(booking.creditAmount || 0);
    const totalCost = parseFloat(booking.totalCost || 0);
    const totalAmount = parseFloat(booking.totalAmount || 0);

    const auditBreakdown = {
      originalPrice: totalCost,
      totalCost: totalCost,
      discounts: {
        promoCode: promoDiscount,
        package: packageDiscount,
        credit: creditUsed,
        total: promoDiscount + packageDiscount + creditUsed
      },
      payments: {
        subtotal: totalPaid - totalCardFee - totalPayNowFee,
        cardFee: Math.round(totalCardFee * 100) / 100,
        payNowFee: Math.round(totalPayNowFee * 100) / 100,
        totalFees: Math.round((totalCardFee + totalPayNowFee) * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100
      },
      paymentBreakdown: paymentBreakdown,
      finalAmount: totalAmount
    };
    
    console.log('📊 Audit breakdown:', auditBreakdown);

    return {
      success: true,
      data: {
        booking,
        user,
        activities: activities.data || [],
        reschedules: reschedules || [],
        refunds: refunds || [],
        doorAccess: doorAccess || [],
        auditBreakdown
      }
    };
  } catch (error) {
    console.error('Error in getComprehensiveBookingDetails:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  ACTIVITY_TYPES,
  logBookingActivity,
  getBookingActivities,
  getBookingActivitiesById,
  getComprehensiveBookingDetails
};

