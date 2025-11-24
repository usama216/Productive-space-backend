const express = require("express");
const { authenticateUser, requireAdmin } = require("../middleware/auth");

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
  deleteUser
} = require("../controllers/userManagementController");

const router = express.Router();
router.post("/create", createBooking);
router.get("/all", getAllBookings);
router.get("/getById/:id", getBookingById);
router.get("/:id", getBookingById);
router.post("/confirmBooking", confirmBookingPayment);
router.post("/confirmWithPackage", confirmBookingWithPackage);
router.post("/getBookedSeats", getBookedSeats);
router.post("/validatePass", validatePassForBooking);
router.post("/applyPass", applyPassToBooking);
router.get("/passBalance/:userId", getUserPassBalance);
router.post("/userStats", getUserBookingStats);

router.post("/user/bookings", getUserBookings);
router.post("/user/analytics", getUserBookingAnalytics);
router.post("/user/dashboard", getUserDashboardSummary);
router.post("/getBookingPaymentDetails", getBookingPaymentDetails);


router.get("/admin/all", authenticateUser, requireAdmin, getAllBookings);
router.get("/admin/details/:idOrRef", authenticateUser, requireAdmin, getAdminBookingDetails);
router.get("/admin/analytics", authenticateUser, requireAdmin, getBookingAnalytics);
router.get("/admin/dashboard", authenticateUser, requireAdmin, getDashboardSummary);
router.put("/admin/:id", authenticateUser, requireAdmin, updateBooking);
router.delete("/admin/:id", authenticateUser, requireAdmin, cancelBooking);

router.post("/extend", extendBooking);
router.post("/confirm-extension-payment", confirmExtensionPayment);

// Admin user management routes - require authentication and admin access
router.get("/admin/users", authenticateUser, requireAdmin, getAllUsers);
router.get("/admin/users/analytics", authenticateUser, requireAdmin, getUserAnalytics);
router.get("/admin/users/dashboard", authenticateUser, requireAdmin, getUserManagementSummary);
router.put("/admin/users/:userId/verify", authenticateUser, requireAdmin, verifyStudentAccount);
router.get("/admin/users/:userId/verification-expiry", authenticateUser, requireAdmin, getVerificationExpiry);
router.delete("/admin/users/:userId", authenticateUser, requireAdmin, deleteUser);
module.exports = router;
