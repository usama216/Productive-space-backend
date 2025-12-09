const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
const {
  getBookingHistory,
  getBookingSummary,
  getUserHistory,
  getDiscountStats
} = require('../controllers/discountHistoryController');

/**
 * @route   GET /api/discount-history/booking/:bookingId
 * @desc    Get discount history for a specific booking
 * @access  Private
 */
router.get('/booking/:bookingId', authenticateUser, getBookingHistory);

/**
 * @route   GET /api/discount-history/booking/:bookingId/summary
 * @desc    Get discount summary for a specific booking (aggregated)
 * @access  Private
 */
router.get('/booking/:bookingId/summary', authenticateUser, getBookingSummary);

/**
 * @route   GET /api/discount-history/user/:userId
 * @desc    Get all discount history for a user
 * @access  Private
 */
router.get('/user/:userId', authenticateUser, requireOwnershipOrAdmin('userId'), getUserHistory);

/**
 * @route   GET /api/discount-history/stats
 * @desc    Get discount statistics (admin)
 * @access  Admin
 */
router.get('/stats', authenticateUser, requireAdmin, getDiscountStats);

module.exports = router;

