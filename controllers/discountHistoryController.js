const {
  getBookingDiscountHistory,
  getUserDiscountHistory,
  getBookingDiscountSummary
} = require('../utils/discountTracker');

/**
 * Get discount history for a specific booking
 * GET /api/discount-history/booking/:bookingId
 */
exports.getBookingHistory = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
    }

    const history = await getBookingDiscountHistory(bookingId);

    res.json({
      success: true,
      bookingId,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('❌ Error in getBookingHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve booking discount history'
    });
  }
};

/**
 * Get discount summary for a specific booking (aggregated)
 * GET /api/discount-history/booking/:bookingId/summary
 */
exports.getBookingSummary = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
    }

    const summary = await getBookingDiscountSummary(bookingId);

    res.json({
      success: true,
      bookingId,
      summary
    });
  } catch (error) {
    console.error('❌ Error in getBookingSummary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve booking discount summary'
    });
  }
};

/**
 * Get all discount history for a user
 * GET /api/discount-history/user/:userId
 */
exports.getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const history = await getUserDiscountHistory(userId);

    // Group by discount type for summary
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
      }
    };

    history.forEach(record => {
      const amount = parseFloat(record.discountAmount);
      summary.totalDiscount += amount;
      summary.byType[record.discountType] = (summary.byType[record.discountType] || 0) + amount;
      summary.byAction[record.actionType] = (summary.byAction[record.actionType] || 0) + amount;
    });

    res.json({
      success: true,
      userId,
      history,
      summary,
      count: history.length
    });
  } catch (error) {
    console.error('❌ Error in getUserHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user discount history'
    });
  }
};

/**
 * Get discount statistics (admin)
 * GET /api/discount-history/stats
 */
exports.getDiscountStats = async (req, res) => {
  try {
    const supabase = require('../config/database');
    
    // Get aggregated stats from BookingDiscountHistory
    const { data: allHistory, error } = await supabase
      .from('BookingDiscountHistory')
      .select('discountType, actionType, discountAmount');

    if (error) {
      throw error;
    }

    const stats = {
      totalDiscounts: allHistory.length,
      totalAmount: 0,
      byType: {
        CREDIT: { count: 0, amount: 0 },
        PASS: { count: 0, amount: 0 },
        PROMO_CODE: { count: 0, amount: 0 }
      },
      byAction: {
        ORIGINAL_BOOKING: { count: 0, amount: 0 },
        RESCHEDULE: { count: 0, amount: 0 },
        EXTENSION: { count: 0, amount: 0 },
        MODIFICATION: { count: 0, amount: 0 }
      }
    };

    allHistory.forEach(record => {
      const amount = parseFloat(record.discountAmount);
      stats.totalAmount += amount;
      
      if (stats.byType[record.discountType]) {
        stats.byType[record.discountType].count += 1;
        stats.byType[record.discountType].amount += amount;
      }
      
      if (stats.byAction[record.actionType]) {
        stats.byAction[record.actionType].count += 1;
        stats.byAction[record.actionType].amount += amount;
      }
    });

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error in getDiscountStats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discount statistics'
    });
  }
};

// Already exported above using exports.functionName
// No need for module.exports here

