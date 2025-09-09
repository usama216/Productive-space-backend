const express = require("express");
const { 
  createBooking, 
  getAllBookings, 
  getBookingById, 
  confirmBookingPayment, 
  confirmBookingWithPackage,
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

/**
 * @swagger
 * /api/booking/create:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - date
 *               - startTime
 *               - endTime
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID making the booking
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Booking date (YYYY-MM-DD)
 *               startTime:
 *                 type: string
 *                 format: time
 *                 description: Start time (HH:MM)
 *               endTime:
 *                 type: string
 *                 format: time
 *                 description: End time (HH:MM)
 *               seatNumber:
 *                 type: string
 *                 description: Preferred seat number
 *     responses:
 *       200:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/create", createBooking);

/**
 * @swagger
 * /api/booking/all:
 *   get:
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: List of all bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/all", getAllBookings);

/**
 * @swagger
 * /api/booking/getById/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/getById/:id", getBookingById);

/**
 * @swagger
 * /api/booking/confirmBooking:
 *   post:
 *     summary: Confirm booking payment
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - paymentReference
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Booking ID to confirm
 *               paymentReference:
 *                 type: string
 *                 description: Payment reference ID
 *     responses:
 *       200:
 *         description: Booking confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/confirmBooking", confirmBookingPayment);

/**
 * @swagger
 * /api/booking/confirmWithPackage:
 *   post:
 *     summary: Confirm booking with package usage
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - userId
 *               - packageId
 *               - hoursUsed
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Booking ID to confirm
 *               userId:
 *                 type: string
 *                 description: User ID
 *               packageId:
 *                 type: string
 *                 description: Package ID to use
 *               hoursUsed:
 *                 type: number
 *                 description: Hours used in the booking
 *               location:
 *                 type: string
 *                 description: Booking location
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Booking start time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Booking end time
 *               paymentId:
 *                 type: string
 *                 description: Payment ID (optional)
 *     responses:
 *       200:
 *         description: Booking confirmed successfully with package usage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 packageUsage:
 *                   type: object
 *                   properties:
 *                     passUsed:
 *                       type: string
 *                     hoursCovered:
 *                       type: number
 *                     excessHours:
 *                       type: number
 *                     excessCharge:
 *                       type: number
 *                     remainingPasses:
 *                       type: number
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/confirmWithPackage", confirmBookingWithPackage);

/**
 * @swagger
 * /api/booking/getBookedSeats:
 *   post:
 *     summary: Get booked seats for a specific date
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date to check booked seats (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of booked seats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bookedSeats:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of booked seat numbers
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/getBookedSeats", getBookedSeats);

/**
 * @swagger
 * /api/booking/userStats:
 *   post:
 *     summary: Get user booking statistics
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to get stats for
 *     responses:
 *       200:
 *         description: User booking statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalBookings:
 *                       type: integer
 *                     completedBookings:
 *                       type: integer
 *                     cancelledBookings:
 *                       type: integer
 *                     totalSpent:
 *                       type: number
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
