const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const { sendBookingConfirmation } = require("../utils/email");



// Helper function to record promo code usage
const recordPromoCodeUsage = async (promoCodeId, userId, bookingId, discountAmount, originalAmount, finalAmount) => {
  try {
    const { error } = await supabase
      .from("PromoCodeUsage")
      .insert([{
        id: uuidv4(),
        promocodeid: promoCodeId,
        userid: userId,
        bookingid: bookingId,
        discountamount: discountAmount,
        originalamount: originalAmount,
        finalamount: finalAmount,
        usedat: new Date().toISOString(),
        createdat: new Date().toISOString()
      }]);

    if (error) {
      console.error("Failed to record promo code usage:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error recording promo code usage:", err);
    return false;
  }
};

// Helper function to update promo code usage count
const updatePromoCodeUsage = async (promoCodeId) => {
  try {
    // First get current usage
    const { data: promoCode, error: fetchError } = await supabase
      .from("PromoCode")
      .select("currentusage, maxtotalusage")
      .eq("id", promoCodeId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch promo code:", fetchError);
      return false;
    }

    // Check if we can still use this promo code
    if (promoCode.maxtotalusage && promoCode.currentusage >= promoCode.maxtotalusage) {
      console.error("Promo code usage limit exceeded");
      return false;
    }

    // Update usage count
    const { error: updateError } = await supabase
      .from("PromoCode")
      .update({
        currentusage: (promoCode.currentusage || 0) + 1,
        updatedat: new Date().toISOString()
      })
      .eq("id", promoCodeId);

    if (updateError) {
      console.error("Failed to update promo code usage:", updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error updating promo code usage:", err);
    return false;
  }
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    // console.log(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

exports.createBooking = async (req, res) => {
  try {

    const {
      id, // Allow custom ID if provided
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
      promoCodeId, // Add promo code ID
      discountAmount // Add discount amount applied
    } = req.body;

    // Check if booking with this ID already exists
    if (id) {
      const { data: existingBooking, error: checkError } = await supabase
        .from("Booking")
        .select("id")
        .eq("id", id)
        .single();

      if (existingBooking && !checkError) {
        return res.status(409).json({ 
          error: "Booking already exists",
          message: "A booking with this ID already exists",
          existingBookingId: id
        });
      }
    }

    // Check if booking with this reference number already exists
    if (bookingRef) {
      const { data: existingRef, error: refError } = await supabase
        .from("Booking")
        .select("id, bookingRef")
        .eq("bookingRef", bookingRef)
        .single();

      if (existingRef && !refError) {
        return res.status(409).json({ 
          error: "Duplicate booking reference",
          message: "A booking with this reference number already exists",
          existingBookingRef: bookingRef
        });
      }
    }

    // Basic promo code validation if provided
    // Full validation will happen during payment confirmation
    if (promoCodeId) {
      const { data: promoCode, error: promoError } = await supabase
        .from("PromoCode")
        .select("id, isactive")
        .eq("id", promoCodeId)
        .eq("isactive", true)
        .single();

      if (promoError || !promoCode) {
        return res.status(400).json({
          error: "Invalid promo code",
          message: "The provided promo code is not valid or inactive"
        });
      }
      // Note: Full validation (expiry, usage limits) happens during payment confirmation
    }

    const { data, error } = await supabase
      .from("Booking")
      .insert([
        {
           id: id || uuidv4(), // Use provided ID or generate new one
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
          promoCodeId,
          discountAmount,
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

    // Note: Promo code usage will be recorded when payment is confirmed
    // This prevents promo code abuse during booking creation

    res.status(201).json({ 
      message: "Booking created successfully", 
      booking: data,
      promoCodeApplied: !!promoCodeId
    });
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

exports.confirmBookingPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    console.log(req.body);
    
    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    // First check if booking exists and get current status
    const { data: existingBooking, error: checkError } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (checkError || !existingBooking) {
      return res.status(404).json({ 
        error: "Booking not found",
        message: `No booking found with ID: ${bookingId}`,
        requestedBookingId: bookingId
      });
    }

    console.log(`Found booking: ${existingBooking.id}, confirmedPayment: ${existingBooking.confirmedPayment}`);

    // Check if payment is already confirmed
    if (existingBooking.confirmedPayment === true || existingBooking.confirmedPayment === "true") {
      // Get payment information if paymentId exists
      let paymentData = null;
      if (existingBooking.paymentId) {
        const { data: payment, error: paymentError } = await supabase
          .from("Payment")
          .select("*")
          .eq("id", existingBooking.paymentId)
          .single();

        if (!paymentError) {
          paymentData = payment;
        }
      }

      console.log(`Booking already confirmed for booking ${existingBooking.id}. Cannot confirm again.`);

      return res.status(400).json({
        error: "Booking already confirmed",
        message: "This booking has already been confirmed. Cannot confirm again.",
        booking: {
          ...existingBooking,
          confirmedPayment: true,
          status: "already_confirmed"
        },
        payment: paymentData,
        totalAmount: existingBooking.totalAmount,
        confirmedPayment: true,
        alreadyConfirmed: true, // Flag to indicate this was already confirmed
        requestedBookingId: bookingId
      });
    }

    // Update booking in Supabase
    const { data, error } = await supabase
      .from("Booking")
      .update({
        confirmedPayment: true,
        updatedAt: new Date().toISOString()
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Fetch payment information if paymentId exists
    let paymentData = null;
    if (data.paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from("Payment")
        .select("*")
        .eq("id", data.paymentId)
        .single();

      if (!paymentError) {
        paymentData = payment;
      }
    }

    // Fetch promo code details if promo code was applied
    let promoCodeData = null;
    if (data.promoCodeId) {
      const { data: promoCode, error: promoError } = await supabase
        .from("PromoCode")
        .select("code, name, description, discounttype, discountvalue")
        .eq("id", data.promoCodeId)
        .single();

      if (!promoError && promoCode) {
        promoCodeData = promoCode;
        // Add promo code details to the booking data for PDF generation
        data.promoCode = promoCode.code;
        data.promoCodeName = promoCode.name;
        data.promoCodeDescription = promoCode.description;
        data.promoCodeType = promoCode.discounttype;
        data.promoCodeValue = promoCode.discountvalue;
      }
    }

    // Record promo code usage if promo code was applied and payment is confirmed
    if (data.promoCodeId && data.discountAmount && data.discountAmount > 0) {
      try {
        // Full promo code validation before recording usage
        const { data: promoCode, error: promoError } = await supabase
          .from("PromoCode")
          .select("*")
          .eq("id", data.promoCodeId)
          .eq("isactive", true)
          .single();

        if (promoError || !promoCode) {
          console.error("❌ Promo code validation failed during payment confirmation:", promoError);
          // Continue with payment confirmation but log the error
        } else {
          // Check if promo code is still active
          const now = new Date();
          if (promoCode.activeto && new Date(promoCode.activeto) < now) {
            console.error("❌ Promo code expired during payment confirmation");
          } else if (promoCode.maxtotalusage && promoCode.currentusage >= promoCode.maxtotalusage) {
            console.error("❌ Promo code usage limit reached during payment confirmation");
          } else {
            // All validations passed, record usage
            const usageRecorded = await recordPromoCodeUsage(
              data.promoCodeId, 
              data.userId, 
              data.id, 
              data.discountAmount, 
              data.totalCost, 
              data.totalAmount
            );

            if (usageRecorded) {
              // Update promo code usage count only after payment confirmation
              await updatePromoCodeUsage(data.promoCodeId);
              console.log(`✅ Promo code ${promoCode.code} usage recorded and count updated`);
            }
          }
        }
      } catch (promoError) {
        console.error("❌ Error recording promo code usage:", promoError);
        // Don't fail the payment confirmation if promo code tracking fails
      }
    }

    const userData = {
      name: "Customer", 
      email: data.bookedForEmails?.[0]
    };

    await sendBookingConfirmation(userData, data);

    res.status(200).json({
      message: "Payment confirmed & confirmation email sent successfully",
      booking: data,
      payment: paymentData,
      promoCode: promoCodeData,
      totalAmount: data.totalAmount,
      confirmedPayment: data.confirmedPayment
    });
  } catch (err) {
    console.error("confirmBookingPayment error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getBookedSeats = async (req, res) => {
  try {
    const { location, startAt, endAt } = req.body;

    if (!location || !startAt || !endAt) {
      return res.status(400).json({ error: "location, startAt and endAt are required" });
    }

    const { data: bookings, error } = await supabase
      .from("Booking")
      .select("seatNumbers")
      .eq("location", location)
      .eq("confirmedPayment", true) 
      .or(
        `and(startAt.lte.${endAt},endAt.gte.${startAt})`
      );

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    const bookedSeats = bookings
      .flatMap(b => b.seatNumbers || [])
      .filter((seat, index, self) => self.indexOf(seat) === index); // unique

    res.status(200).json({ bookedSeats });
  } catch (err) {
    console.error("getBookedSeats error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getUserBookingStats = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const now = new Date().toISOString();

    const { count: upcomingCount, error: upcomingError } = await supabase
      .from("Booking")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("confirmedPayment", true) 
      .gte("startAt", now);

    if (upcomingError) {
      console.error(upcomingError);
      return res.status(400).json({ error: upcomingError.message });
    }

    const { count: pastCount, error: pastError } = await supabase
      .from("Booking")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("confirmedPayment", true) 
      .lt("endAt", now);

    if (pastError) {
      console.error(pastError);
      return res.status(400).json({ error: pastError.message });
    }

    res.status(200).json({
      userId,
      upcomingBookings: upcomingCount || 0,
      pastBookings: pastCount || 0
    });
  } catch (err) {
    console.error("getUserBookingStats error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ==================== ADMIN BOOKING MANAGEMENT APIs ====================

// Get all bookings with comprehensive filters (admin) - FIXED VERSION
exports.getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      location,
      dateFrom,
      dateTo,
      memberType,
      paymentStatus,
      sortBy = 'startAt',
      sortOrder = 'desc'
    } = req.query;

    // Build the base query - Use simple select to avoid relationship issues
    let query = supabase
      .from('Booking')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`bookingRef.ilike.%${search}%,location.ilike.%${search}%`);
    }

    if (status) {
      const now = new Date().toISOString();
      if (status === 'upcoming') {
        query = query.gt('startAt', now);
      } else if (status === 'ongoing') {
        query = query.lte('startAt', now).gt('endAt', now);
      } else if (status === 'completed') {
        query = query.lt('endAt', now);
      } else if (status === 'today') {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
        query = query.gte('startAt', startOfDay).lte('startAt', endOfDay);
      }
    }

    if (location) {
      query = query.eq('location', location);
    }

    if (dateFrom) {
      query = query.gte('startAt', dateFrom);
    }

    if (dateTo) {
      query = query.lte('startAt', dateTo);
    }

    if (memberType) {
      query = query.eq('memberType', memberType);
    }

    if (paymentStatus) {
      if (paymentStatus === 'paid') {
        query = query.eq('confirmedPayment', true);
      } else if (paymentStatus === 'unpaid') {
        query = query.eq('confirmedPayment', false);
      }
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      console.error('getAllBookings error:', error);
      return res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
    }

    // Get user data separately to avoid relationship conflicts
    const userIds = bookings
      .filter(b => b.userId)
      .map(b => b.userId);
    
    let userData = {};
    if (userIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('User')
        .select('id, name, email, memberType')
        .in('id', userIds);
      
      if (!userError && users) {
        users.forEach(user => {
          userData[user.id] = user;
        });
      }
    }

    // Get promo code data separately to avoid relationship conflicts
    const promoCodeIds = bookings
      .filter(b => b.promoCodeId)
      .map(b => b.promoCodeId);
    
    let promoCodeData = {};
    if (promoCodeIds.length > 0) {
      const { data: promoCodes, error: promoError } = await supabase
        .from('PromoCode')
        .select('id, code, discountAmount')
        .in('id', promoCodeIds);
      
      if (!promoError && promoCodes) {
        promoCodes.forEach(promo => {
          promoCodeData[promo.id] = promo;
        });
      }
    }

    // Calculate additional fields for each booking
    const now = new Date();
    const bookingsWithStatus = bookings.map(booking => {
      const startAt = new Date(booking.startAt);
      const endAt = new Date(booking.endAt);
      
      const isUpcoming = startAt > now;
      const isOngoing = startAt <= now && endAt > now;
      const isCompleted = endAt <= now;
      const isToday = startAt.toDateString() === now.toDateString();
      
      const durationMs = endAt.getTime() - startAt.getTime();
      const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 100) / 100;
      
      let timeUntilBooking = null;
      if (isUpcoming) {
        const remainingMs = startAt.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        timeUntilBooking = `${remainingHours}h ${remainingMinutes}m`;
      }

      // Add user and promo code data if available
      const user = booking.userId ? userData[booking.userId] : null;
      const promoCode = booking.promoCodeId ? promoCodeData[booking.promoCodeId] : null;

      return {
        ...booking,
        isUpcoming,
        isOngoing,
        isCompleted,
        isToday,
        durationHours,
        timeUntilBooking,
        status: isUpcoming ? 'upcoming' : isOngoing ? 'ongoing' : 'completed',
        User: user,
        PromoCode: promoCode
      };
    });

    // Calculate summary statistics
    const totalBookings = count || 0;
    const upcomingBookings = bookingsWithStatus.filter(b => b.isUpcoming).length;
    const ongoingBookings = bookingsWithStatus.filter(b => b.isOngoing).length;
    const completedBookings = bookingsWithStatus.filter(b => b.isCompleted).length;
    const totalRevenue = bookingsWithStatus
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const pendingPayments = bookingsWithStatus
      .filter(b => !b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    res.json({
      bookings: bookingsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalBookings,
        totalPages: Math.ceil(totalBookings / limit)
      },
      summary: {
        totalBookings,
        upcomingBookings,
        ongoingBookings,
        completedBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        pendingPayments: Math.round(pendingPayments * 100) / 100
      }
    });

  } catch (err) {
    console.error('getAllBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
};

// Get booking analytics and statistics
exports.getBookingAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    endDate = now;

    // Get bookings in date range
    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .gte('startAt', startDate.toISOString())
      .lte('startAt', endDate.toISOString());

    if (error) {
      console.error('getBookingAnalytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    // Calculate analytics
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.confirmedPayment).length;
    const pendingBookings = totalBookings - confirmedBookings;
    const totalRevenue = bookings
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Breakdown by location
    const locationBreakdown = {};
    bookings.forEach(booking => {
      const loc = booking.location || 'Unknown';
      if (!locationBreakdown[loc]) {
        locationBreakdown[loc] = { count: 0, revenue: 0 };
      }
      locationBreakdown[loc].count++;
      if (booking.confirmedPayment) {
        locationBreakdown[loc].revenue += parseFloat(booking.totalAmount || 0);
      }
    });

    // Breakdown by member type
    const memberTypeBreakdown = {};
    bookings.forEach(booking => {
      const type = booking.memberType || 'regular';
      if (!memberTypeBreakdown[type]) {
        memberTypeBreakdown[type] = { count: 0, revenue: 0 };
      }
      memberTypeBreakdown[type].count++;
      if (booking.confirmedPayment) {
        memberTypeBreakdown[type].revenue += parseFloat(booking.totalAmount || 0);
      }
    });

    // Daily trends
    const dailyTrends = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyTrends[dateKey] = { bookings: 0, revenue: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    bookings.forEach(booking => {
      const dateKey = new Date(booking.startAt).toISOString().split('T')[0];
      if (dailyTrends[dateKey]) {
        dailyTrends[dateKey].bookings++;
        if (booking.confirmedPayment) {
          dailyTrends[dateKey].revenue += parseFloat(booking.totalAmount || 0);
        }
      }
    });

    res.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageBookingValue: Math.round(averageBookingValue * 100) / 100
      },
      breakdowns: {
        byLocation: locationBreakdown,
        byMemberType: memberTypeBreakdown
      },
      trends: {
        daily: dailyTrends
      }
    });

  } catch (err) {
    console.error('getBookingAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// Get dashboard summary
exports.getDashboardSummary = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today's bookings
    const { count: todayBookings } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .gte('startAt', today.toISOString())
      .lt('startAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    // This month's revenue
    const { data: monthBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .gte('startAt', startOfMonth.toISOString())
      .lte('startAt', now.toISOString())
      .eq('confirmedPayment', true);

    const monthRevenue = monthBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    // Upcoming bookings
    const { count: upcomingCount } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .gt('startAt', now.toISOString());

    // Pending payments
    const { data: pendingBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .eq('confirmedPayment', false);

    const pendingAmount = pendingBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    res.json({
      today: {
        bookings: todayBookings || 0
      },
      thisMonth: {
        revenue: Math.round(monthRevenue * 100) / 100
      },
      upcoming: {
        count: upcomingCount || 0
      },
      pending: {
        amount: Math.round(pendingAmount * 100) / 100
      },
      lastUpdated: now.toISOString()
    });

  } catch (err) {
    console.error('getDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};

// Update booking (admin)
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if booking exists
    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Update booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('Booking')
      .update({
        ...updateData,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('updateBooking error:', updateError);
      return res.status(500).json({ error: 'Failed to update booking' });
    }

    // Get user data separately
    let userData = null;
    if (updatedBooking.userId) {
      const { data: user, error: userError } = await supabase
        .from('User')
        .select('id, name, email')
        .eq('id', updatedBooking.userId)
        .single();
      
      if (!userError && user) {
        userData = user;
      }
    }

    const finalResponse = {
      ...updatedBooking,
      User: userData
    };

    if (updateError) {
      console.error('updateBooking error:', updateError);
      return res.status(500).json({ error: 'Failed to update booking' });
    }

    res.json({
      message: 'Booking updated successfully',
      booking: finalResponse
    });

  } catch (err) {
    console.error('updateBooking error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
};

// Cancel/Delete booking (admin)
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refundAmount } = req.body;

    // Check if booking exists
    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if booking is in the future
    const now = new Date();
    const startAt = new Date(existingBooking.startAt);
    
    if (startAt <= now) {
      return res.status(400).json({ error: 'Cannot cancel past or ongoing bookings' });
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from('Booking')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('cancelBooking error:', deleteError);
      return res.status(500).json({ error: 'Failed to cancel booking' });
    }

    res.json({
      message: 'Booking cancelled successfully',
      cancelledBooking: {
        id: existingBooking.id,
        bookingRef: existingBooking.bookingRef,
        reason: reason || 'Admin cancellation',
        refundAmount: refundAmount || existingBooking.totalAmount
      }
    });

  } catch (err) {
    console.error('cancelBooking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};
