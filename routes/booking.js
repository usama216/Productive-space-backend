const express = require("express");
const { 
  createBooking, 
  getAllBookings, 
  getBookingById, 
  confirmBookingPayment, 
  getBookedSeats, 
  getUserBookingStats,
  // User Dashboard functions
  getUserBookings,
  getUserBookingAnalytics,
  getUserDashboardSummary,
  // Admin functions
  getBookingAnalytics,
  updateBooking,
  cancelBooking,
  getDashboardSummary,
  // Admin User Management functions
  getAllUsers,
  getUserAnalytics,
  getUserManagementSummary,
  verifyStudentAccount,
  deleteUser
} = require("../controllers/bookingController");

const router = express.Router();

// ==================== USER/CLIENT ROUTES ====================
router.post("/create", createBooking);
router.get("/all", getAllBookings);
router.get("/getById/:id", getBookingById);
router.post("/confirmBooking", confirmBookingPayment);
router.post("/getBookedSeats", getBookedSeats);
router.post("/userStats", getUserBookingStats);

// ==================== USER DASHBOARD ROUTES ====================
// Get user's own bookings with filters
router.post("/user/bookings", getUserBookings);

// Get user's own analytics
router.post("/user/analytics", getUserBookingAnalytics);

// Get user's own dashboard summary
router.post("/user/dashboard", getUserDashboardSummary);

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

// ==================== ADMIN USER MANAGEMENT ROUTES ====================
// Get all users with filters and pagination
router.get("/admin/users", getAllUsers);

// Get user analytics and statistics
router.get("/admin/users/analytics", getUserAnalytics);

// Get user management dashboard summary
router.get("/admin/users/dashboard", getUserManagementSummary);
router.put("/admin/users/:userId/verify", verifyStudentAccount);

// Delete user (ADMIN)
router.delete("/admin/users/:userId", deleteUser);
module.exports = router;
