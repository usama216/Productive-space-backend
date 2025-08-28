const express = require("express");
const { 
  createBooking, 
  getAllBookings, 
  getBookingById, 
  confirmBookingPayment, 
  getBookedSeats, 
  getUserBookingStats,
  // Admin functions
  getBookingAnalytics,
  updateBooking,
  cancelBooking,
  getDashboardSummary
} = require("../controllers/bookingController");

const router = express.Router();

// ==================== USER/CLIENT ROUTES ====================
router.post("/create", createBooking);
router.get("/all", getAllBookings);
router.get("/getById/:id", getBookingById);
router.post("/confirmBooking", confirmBookingPayment);
router.post("/getBookedSeats", getBookedSeats);
router.post("/userStats", getUserBookingStats);

// ==================== ADMIN ROUTES ====================
// Get all bookings with comprehensive filters (PUBLIC FOR NOW)
router.get("/admin/all", getAllBookings);

// Get booking analytics and statistics
router.get("/admin/analytics", getBookingAnalytics);

// Get dashboard summary
router.get("/admin/dashboard", getDashboardSummary);

// Update booking (ADMIN)
router.put("/admin/:id", updateBooking);

// Cancel/delete booking (ADMIN)
router.delete("/admin/:id", cancelBooking);

module.exports = router;
