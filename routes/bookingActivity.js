const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const {
  getBookingTimeline,
  getBookingTimelineById,
  getComprehensiveDetails
} = require('../controllers/bookingActivityController');

/**
 * @swagger
 * /booking-activity/timeline/{bookingRef}:
 *   get:
 *     summary: Get activity timeline for a booking by reference
 *     description: Retrieve all activities/changes for a specific booking
 *     tags: [Booking Activity]
 *     parameters:
 *       - in: path
 *         name: bookingRef
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking reference (e.g., BOOK12345)
 *     responses:
 *       200:
 *         description: Successfully retrieved timeline
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
// User routes (authentication required)
router.get('/timeline/:bookingRef', authenticateUser, getBookingTimeline);
router.get('/timeline-by-id/:bookingId', authenticateUser, getBookingTimelineById);
router.get('/comprehensive/:bookingRef', authenticateUser, getComprehensiveDetails);

module.exports = router;

