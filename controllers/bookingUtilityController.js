const { 
  validatePassUsage, 
  applyPassToBooking, 
  getUserPassBalance 
} = require("./countBasedPackageController");
const supabase = require("../config/database");

exports.getBookedSeats = async (req, res) => {
  try {
    const { location, startAt, endAt, excludeBookingId } = req.body;

    console.log('🔍 getBookedSeats request:', { location, startAt, endAt, excludeBookingId });

    if (!location || !startAt || !endAt) {
      return res.status(400).json({ error: "location, startAt and endAt are required" });
    }

    // Ensure times are treated as UTC by adding 'Z' if not present
    const startAtUTC = startAt.endsWith('Z') ? startAt : startAt + 'Z';
    const endAtUTC = endAt.endsWith('Z') ? endAt : endAt + 'Z';

    console.log('🔍 UTC times:', { startAtUTC, endAtUTC });

    let query = supabase
      .from("Booking")
      .select("seatNumbers, startAt, endAt, bookingRef, confirmedPayment, createdAt")
      .eq("location", location)
      .in("confirmedPayment", [true, false])
      .lt("startAt", endAtUTC)  
      .gt("endAt", startAtUTC);

    // Exclude the specified booking ID if provided (for reschedule scenarios)
    if (excludeBookingId) {
      console.log('🔍 Excluding booking ID:', excludeBookingId);
      query = query.neq("id", excludeBookingId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log('🔍 Found bookings:', bookings?.length || 0);
    console.log('🔍 Bookings data:', bookings);

    const bookedSeats = bookings
      ?.flatMap(b => b.seatNumbers || [])
      .filter((seat, index, self) => self.indexOf(seat) === index) || [];

    console.log('🔍 Booked seats:', bookedSeats);

    // Get current booking details to check its seats
    let currentBookingSeats = [];
    if (excludeBookingId) {
      const { data: currentBooking, error: currentBookingError } = await supabase
        .from('Booking')
        .select('seatNumbers')
        .eq('id', excludeBookingId)
        .single();
      
      if (!currentBookingError && currentBooking) {
        currentBookingSeats = currentBooking.seatNumbers || [];
        console.log('🔍 Current booking seats:', currentBookingSeats);
      }
    }

    // Define all available seats (S1-S15 only)
    const allSeats = [
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10',
      'S11', 'S12', 'S13', 'S14', 'S15'
    ];

    // Calculate available seats (all seats minus booked seats)
    const availableSeats = allSeats.filter(seat => !bookedSeats.includes(seat));

    console.log('🔍 Available seats:', availableSeats);
    console.log('🔍 Current booking seats that should be available:', currentBookingSeats);
    
    // Check if current booking seats conflict with other bookings
    // If current booking seat is in bookedSeats, it means it's conflicting with another booking
    const conflictingCurrentSeats = currentBookingSeats.filter(seat => 
      bookedSeats.includes(seat)
    );
    
    console.log('🔍 Conflicting current seats:', conflictingCurrentSeats);

    const confirmedBookings = bookings?.filter(b => b.confirmedPayment) || [];
    const pendingBookings = bookings?.filter(b => !b.confirmedPayment) || [];

    res.status(200).json({ 
      bookedSeats,
      availableSeats,
      currentBookingSeats,
      conflictingCurrentSeats,
      overlappingBookings: bookings?.map(b => ({
        bookingRef: b.bookingRef,
        startAt: b.startAt,
        endAt: b.endAt,
        seats: b.seatNumbers,
        confirmedPayment: b.confirmedPayment,
        createdAt: b.createdAt
      })) || [],
      summary: {
        totalOverlapping: bookings?.length || 0,
        confirmed: confirmedBookings.length,
        pending: pendingBookings.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.validatePassForBooking = async (req, res) => {
  try {
    const { userId, passType, startTime, endTime, pax } = req.body;

    if (!userId || !passType || !startTime || !endTime || !pax) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'userId, passType, startTime, endTime, and pax are required'
      });
    }

    const validation = await validatePassUsage(userId, passType, startTime, endTime, pax);
    
    if (validation.success) {
      res.json({
        success: true,
        validation: validation,
        message: 'Pass validation successful'
      });
    } else {
      res.status(400).json({
        success: false,
        error: validation.error,
        message: validation.message,
        details: validation
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to validate pass usage'
    });
  }
};

exports.applyPassToBooking = async (req, res) => {
  try {
    const { userId, passId, bookingId, location, startTime, endTime, pax } = req.body;

    if (!userId || !passId || !bookingId || !location || !startTime || !endTime || !pax) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'All fields are required'
      });
    }

    const result = await applyPassToBooking(userId, passId, bookingId, location, startTime, endTime, pax);
    
    if (result.success) {
      res.json({
        success: true,
        result: result,
        message: 'Pass successfully applied to booking'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to apply pass to booking'
    });
  }
};

exports.getUserPassBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing user ID',
        message: 'User ID is required'
      });
    }

    const balance = await getUserPassBalance(userId);
    
    if (balance.success) {
      res.json({
        success: true,
        balance: balance,
        message: 'Pass balance retrieved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: balance.error,
        message: balance.message
      });
    }

  } catch (error) {
    console.error('Error in getUserPassBalance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to get pass balance'
    });
  }
};

