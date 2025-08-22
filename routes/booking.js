const express = require("express");
const { createBooking, getAllBookings, getBookingById, confirmBookingPayment, getBookedSeats, getUserBookingStats } = require("../controllers/bookingController");

const router = express.Router();

router.post("/create", createBooking);
router.get("/all", getAllBookings);
router.get("/getById/:id",getBookingById);
router.post("/confirmBooking",confirmBookingPayment);
router.post("/getBookedSeats",getBookedSeats);
router.post("/userStats",getUserBookingStats);


module.exports = router;
