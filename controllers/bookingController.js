const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

exports.createBooking = async (req, res) => {
  try {

    const {
      bookingRef,
      userId,
      location,
      bookedAt,
      startAt,
      endAt,
      specialRequests,
      seatNumbers,
      pax,
      students,
      members,
      tutors,
      totalCost,
      discountId,
      totalAmount,
      memberType,
      bookedForEmails,
      confirmedPayment,
      paymentId
    } = req.body;

    const { data, error } = await supabase
      .from("Booking")
      .insert([
        {
           id :uuidv4(),
          bookingRef,
          userId,
          location,
          bookedAt,
          startAt,
          endAt,
          specialRequests,
          seatNumbers,
          pax,
          students,
          members,
          tutors,
          totalCost,
          discountId,
          totalAmount,
          memberType,
          bookedForEmails,
          confirmedPayment,
          paymentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
        console.error(error)
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: "Booking created successfully", booking: data });
  } catch (err) {
    console.error("createBooking error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Booking")
      .select("*")
      .order("createdAt", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ bookings: data });
  } catch (err) {
    console.error("getAllBookings error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      return res.status(404).json({ error: "Booking not found" });
    }

    res.status(200).json({ booking: data });
  } catch (err) {
    console.error("getBookingById error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};