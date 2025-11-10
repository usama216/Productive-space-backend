const express = require('express');
const router = express.Router();
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
router.get('/timeline/:bookingRef', getBookingTimeline);

/**
 * @swagger
 * /booking-activity/timeline-by-id/{bookingId}:
 *   get:
 *     summary: Get activity timeline for a booking by ID
 *     description: Retrieve all activities/changes for a specific booking using database ID
 *     tags: [Booking Activity]
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Booking database ID
 *     responses:
 *       200:
 *         description: Successfully retrieved timeline
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.get('/timeline-by-id/:bookingId', getBookingTimelineById);

/**
 * @swagger
 * /booking-activity/comprehensive/{bookingRef}:
 *   get:
 *     summary: Get comprehensive booking details
 *     description: Get complete booking information including activities, reschedules, refunds, door access, etc.
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
 *         description: Successfully retrieved comprehensive details
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.get('/comprehensive/:bookingRef', getComprehensiveDetails);

module.exports = router;

