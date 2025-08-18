const express = require("express");
const { createBooking, getAllBookings, getBookingById, confirmBookingPayment } = require("../controllers/bookingController");

const router = express.Router();

router.post("/create", createBooking);
router.get("/all", getAllBookings);
router.get("/getById/:id",getBookingById);
router.post("/confirmBooking",confirmBookingPayment);


module.exports = router;
