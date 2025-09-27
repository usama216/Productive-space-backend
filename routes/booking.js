const express = require("express");
const { 
  createBooking, 
  getAllBookings, 
  getBookingById, 
  confirmBookingPayment, 
  confirmBookingWithPackage,
  getBookedSeats, 
  getUserBookingStats,
  validatePassForBooking,
  applyPassToBooking,
  getUserPassBalance,
  getUserBookings,
  getUserBookingAnalytics,
  getUserDashboardSummary,
  getBookingAnalytics,
  updateBooking,
  cancelBooking,
  getDashboardSummary,
  extendBooking,
  confirmExtensionPayment,

  getAllUsers,
  getUserAnalytics,
  getUserManagementSummary,
  verifyStudentAccount,
  deleteUser
} = require("../controllers/bookingController");

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
router.get("/admin/all", getAllBookings);

router.get("/admin/analytics", getBookingAnalytics);
router.get("/admin/dashboard", getDashboardSummary);

router.put("/admin/:id", updateBooking);
router.delete("/admin/:id", cancelBooking);
router.post("/extend", extendBooking);
router.post("/confirm-extension-payment", confirmExtensionPayment);

router.get("/admin/users", getAllUsers);
router.get("/admin/users/analytics", getUserAnalytics);
router.get("/admin/users/dashboard", getUserManagementSummary);
router.put("/admin/users/:userId/verify", verifyStudentAccount);

router.delete("/admin/users/:userId", deleteUser);
module.exports = router;
