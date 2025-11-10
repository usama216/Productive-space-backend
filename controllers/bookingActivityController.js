const {
  getBookingActivities,
  getBookingActivitiesById,
  getComprehensiveBookingDetails
} = require('../utils/bookingActivityLogger');

/**
 * Get activity timeline for a booking by reference
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBookingTimeline = async (req, res) => {
  try {
    const { bookingRef } = req.params;

    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        message: 'Booking reference is required'
      });
    }

    const result = await getBookingActivities(bookingRef);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch booking timeline',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      count: result.data.length
    });
  } catch (error) {
    console.error('Error in getBookingTimeline:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get activity timeline for a booking by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBookingTimelineById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    const result = await getBookingActivitiesById(parseInt(bookingId));

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch booking timeline',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      count: result.data.length
    });
  } catch (error) {
    console.error('Error in getBookingTimelineById:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get comprehensive booking details including all related data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getComprehensiveDetails = async (req, res) => {
  try {
    const { bookingRef } = req.params;

    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        message: 'Booking reference is required'
      });
    }

    const result = await getComprehensiveBookingDetails(bookingRef);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch booking details',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error in getComprehensiveDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getBookingTimeline,
  getBookingTimelineById,
  getComprehensiveDetails
};

