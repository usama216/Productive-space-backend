const express = require('express')
const router = express.Router()
const { rescheduleBooking, getAvailableSeatsForReschedule } = require('../controllers/rescheduleController')

// Middleware to authenticate user (you may need to adjust this based on your auth setup)
const authenticateUser = (req, res, next) => {
  // This is a placeholder - implement your actual authentication middleware
  // For now, we'll skip auth validation in the controller
  next()
}

// Reschedule booking endpoint
router.put('/booking/:bookingId', authenticateUser, rescheduleBooking)

// Get available seats for reschedule
router.get('/booking/:bookingId/available-seats', authenticateUser, getAvailableSeatsForReschedule)

module.exports = router
