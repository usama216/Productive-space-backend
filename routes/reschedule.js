const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { rescheduleBooking, getAvailableSeatsForReschedule, confirmReschedulePayment } = require('../controllers/rescheduleController');

// User routes (authentication required)
router.put('/booking/:bookingId', authenticateUser, rescheduleBooking);
router.get('/booking/:bookingId/available-seats', authenticateUser, getAvailableSeatsForReschedule);
router.post('/confirm-payment', authenticateUser, confirmReschedulePayment);

module.exports = router;
