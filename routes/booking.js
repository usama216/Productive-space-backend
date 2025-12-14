const express = require("express");
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require("../middleware/auth");

// Import from new modular controllers
const {
  createBooking,
  getAllBookings,
  getBookingById,
  getAdminBookingDetails,
  updateBooking,
  cancelBooking
} = require("../controllers/bookingCoreController");

const {
  confirmBookingPayment,
  confirmBookingWithPackage,
  getBookingPaymentDetails
} = require("../controllers/bookingPaymentController");

const {
  extendBooking,
  confirmExtensionPayment
} = require("../controllers/bookingExtensionController");

const {
  getBookedSeats,
  validatePassForBooking,
  applyPassToBooking,
  getUserPassBalance
} = require("../controllers/bookingUtilityController");

const {
  getUserBookings,
  getUserBookingStats,
  getUserBookingAnalytics,
  getUserDashboardSummary
} = require("../controllers/userBookingController");

const {
  getBookingAnalytics,
  getDashboardSummary
} = require("../controllers/adminBookingController");

const {
  getAllUsers,
  getUserAnalytics,
  getUserManagementSummary,
  verifyStudentAccount,
  getVerificationExpiry,
  deleteUser,
  changeUserRole,
  disableUser,
  enableUser
} = require("../controllers/userManagementController");

const router = express.Router();

// Public routes (no authentication required)
router.get("/getById/:id", getBookingById);
router.get("/:id", getBookingById);
router.post("/getBookedSeats", getBookedSeats);

// User routes (authentication required)
router.post("/create", authenticateUser, createBooking);
router.post("/confirmBooking", authenticateUser, confirmBookingPayment);
router.post("/confirmWithPackage", authenticateUser, confirmBookingWithPackage);
router.post("/validatePass", authenticateUser, validatePassForBooking);
router.post("/applyPass", authenticateUser, applyPassToBooking);
router.get("/passBalance/:userId", authenticateUser, requireOwnershipOrAdmin('userId'), getUserPassBalance);
router.post("/userStats", authenticateUser, getUserBookingStats);
router.post("/user/bookings", authenticateUser, getUserBookings);
router.post("/user/analytics", authenticateUser, getUserBookingAnalytics);
router.post("/user/dashboard", authenticateUser, getUserDashboardSummary);
router.post("/getBookingPaymentDetails", authenticateUser, getBookingPaymentDetails);
router.post("/extend", authenticateUser, extendBooking);
router.post("/confirm-extension-payment", authenticateUser, confirmExtensionPayment);


router.get("/admin/all", authenticateUser, requireAdmin, getAllBookings);
router.get("/admin/details/:idOrRef", authenticateUser, requireAdmin, getAdminBookingDetails);
router.get("/admin/analytics", authenticateUser, requireAdmin, getBookingAnalytics);
router.get("/admin/dashboard", authenticateUser, requireAdmin, getDashboardSummary);
router.put("/admin/:id", authenticateUser, requireAdmin, updateBooking);
router.delete("/admin/:id", authenticateUser, requireAdmin, cancelBooking);


// Admin user management routes - require authentication and admin access
router.get("/admin/users", authenticateUser, requireAdmin, getAllUsers);
router.get("/admin/users/analytics", authenticateUser, requireAdmin, getUserAnalytics);
router.get("/admin/users/dashboard", authenticateUser, requireAdmin, getUserManagementSummary);
router.put("/admin/users/:userId/verify", authenticateUser, requireAdmin, verifyStudentAccount);
router.get("/admin/users/:userId/verification-expiry", authenticateUser, requireAdmin, getVerificationExpiry);
router.put("/admin/users/:userId/role", authenticateUser, requireAdmin, changeUserRole);
router.put("/admin/users/:userId/disable", authenticateUser, requireAdmin, disableUser);
router.put("/admin/users/:userId/enable", authenticateUser, requireAdmin, enableUser);
router.delete("/admin/users/:userId", authenticateUser, requireAdmin, deleteUser);
module.exports = router;
