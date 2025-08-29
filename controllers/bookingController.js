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

const supabase = require("../config/database");

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

    // TEMPORARILY COMMENTED OUT FOR TESTING - UNCOMMENT AFTER TESTING IS COMPLETE
    // Check if booking with this ID already exists
    /*
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
    */

    // TEMPORARILY COMMENTED OUT FOR TESTING - UNCOMMENT AFTER TESTING IS COMPLETE
    // Check if booking with this reference number already exists
    /*
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
    */

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

    // TEMPORARILY COMMENTED OUT FOR TESTING - UNCOMMENT AFTER TESTING IS COMPLETE
    // Check if payment is already confirmed
    /*
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
    */

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

    // Add payment method information to the booking data for email
    if (paymentData) {
      // Try to get the actual payment method from payment data
      // If not available, we'll let the email template handle it
      data.paymentMethod = paymentData.paymentMethod || null;
      data.paymentDetails = paymentData;
    }

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

// ==================== USER DASHBOARD APIs ====================

// Get user's own bookings with filters and pagination
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.body;
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      sortBy = 'startAt',
      sortOrder = 'desc'
    } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Build the base query - only for this specific user
    let query = supabase
      .from('Booking')
      .select('*', { count: 'exact' })
      .eq('userId', userId); // This ensures only user's own bookings

    // Apply status filters
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

    // Apply payment status filter
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
      console.error('getUserBookings error:', error);
      return res.status(500).json({ error: 'Failed to fetch user bookings', details: error.message });
    }

    // Get promo code data for user's bookings
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

      // Add promo code data if available
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
        PromoCode: promoCode
      };
    });

    // Calculate summary statistics for this user only
    const totalBookings = count || 0;
    const upcomingBookings = bookingsWithStatus.filter(b => b.isUpcoming).length;
    const ongoingBookings = bookingsWithStatus.filter(b => b.isOngoing).length;
    const completedBookings = bookingsWithStatus.filter(b => b.isCompleted).length;
    const totalSpent = bookingsWithStatus
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const pendingPayments = bookingsWithStatus
      .filter(b => !b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    res.json({
      userId,
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
        totalSpent: Math.round(totalSpent * 100) / 100,
        pendingPayments: Math.round(pendingPayments * 100) / 100
      }
    });

  } catch (err) {
    console.error('getUserBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch user bookings', details: err.message });
  }
};

// Get user's own booking analytics
exports.getUserBookingAnalytics = async (req, res) => {
  try {
    const { userId } = req.body;
    const { period = 'month' } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

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

    // Get user's bookings in date range
    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .eq('userId', userId) // Only this user's bookings
      .gte('startAt', startDate.toISOString())
      .lte('startAt', endDate.toISOString());

    if (error) {
      console.error('getUserBookingAnalytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch user analytics' });
    }

    // Calculate analytics for this user only
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.confirmedPayment).length;
    const pendingBookings = totalBookings - confirmedBookings;
    const totalSpent = bookings
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const averageBookingValue = totalBookings > 0 ? totalSpent / totalBookings : 0;

    // Breakdown by location for this user
    const locationBreakdown = {};
    bookings.forEach(booking => {
      const loc = booking.location || 'Unknown';
      if (!locationBreakdown[loc]) {
        locationBreakdown[loc] = { count: 0, spent: 0 };
      }
      locationBreakdown[loc].count++;
      if (booking.confirmedPayment) {
        locationBreakdown[loc].spent += parseFloat(booking.totalAmount || 0);
      }
    });

    // Daily trends for this user
    const dailyTrends = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyTrends[dateKey] = { bookings: 0, spent: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    bookings.forEach(booking => {
      const dateKey = new Date(booking.startAt).toISOString().split('T')[0];
      if (dailyTrends[dateKey]) {
        dailyTrends[dateKey].bookings++;
        if (booking.confirmedPayment) {
          dailyTrends[dateKey].spent += parseFloat(booking.totalAmount || 0);
        }
      }
    });

    res.json({
      userId,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        totalSpent: Math.round(totalSpent * 100) / 100,
        averageBookingValue: Math.round(averageBookingValue * 100) / 100
      },
      breakdowns: {
        byLocation: locationBreakdown
      },
      trends: {
        daily: dailyTrends
      }
    });

  } catch (err) {
    console.error('getUserBookingAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
};

// Get user's own dashboard summary
exports.getUserDashboardSummary = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today's bookings for this user only
    const { count: todayBookings } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId) // Only this user's bookings
      .gte('startAt', today.toISOString())
      .lt('startAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    // This month's spending for this user only
    const { data: monthBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .eq('userId', userId) // Only this user's bookings
      .gte('startAt', startOfMonth.toISOString())
      .lte('startAt', now.toISOString())
      .eq('confirmedPayment', true);

    const monthSpent = monthBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    // Upcoming bookings for this user only
    const { count: upcomingCount } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId) // Only this user's bookings
      .gt('startAt', now.toISOString());

    // Pending payments for this user only
    const { data: pendingBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .eq('userId', userId) // Only this user's bookings
      .eq('confirmedPayment', false);

    const pendingAmount = pendingBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    res.json({
      userId,
      today: {
        bookings: todayBookings || 0
      },
      thisMonth: {
        spent: Math.round(monthSpent * 100) / 100
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
    console.error('getUserDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch user dashboard summary' });
  }
};

// Enhanced user booking stats (keeping the original for backward compatibility)
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

// ==================== ADMIN USER MANAGEMENT APIs ====================

// Get all users with comprehensive filters and analytics
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      memberType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeStats = 'false'
    } = req.query;

    // Build the base query
    let query = supabase
      .from('User')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply member type filter
    if (memberType) {
      query = query.eq('memberType', memberType);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('getAllUsers error:', error);
      return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }

    // If includeStats is true, get additional user statistics
    let usersWithStats = users;
    if (includeStats === 'true') {
      const userIds = users.map(user => user.id);
      
      // Get booking counts for each user
      const { data: bookingCounts, error: bookingError } = await supabase
        .from('Booking')
        .select('userId, confirmedPayment, totalAmount')
        .in('userId', userIds);

      if (!bookingError && bookingCounts) {
        // Group bookings by user
        const userBookings = {};
        bookingCounts.forEach(booking => {
          if (!userBookings[booking.userId]) {
            userBookings[booking.userId] = {
              totalBookings: 0,
              confirmedBookings: 0,
              totalSpent: 0
            };
          }
          userBookings[booking.userId].totalBookings++;
          if (booking.confirmedPayment) {
            userBookings[booking.userId].confirmedBookings++;
            userBookings[booking.userId].totalSpent += parseFloat(booking.totalAmount || 0);
          }
        });

        // Add stats to users
        usersWithStats = users.map(user => ({
          ...user,
          stats: userBookings[user.id] || {
            totalBookings: 0,
            confirmedBookings: 0,
            totalSpent: 0
          }
        }));
      }
    }

    // Calculate summary statistics
    const totalUsers = count || 0;
    const memberTypeBreakdown = {};
    users.forEach(user => {
      const type = user.memberType || 'regular';
      if (!memberTypeBreakdown[type]) {
        memberTypeBreakdown[type] = 0;
      }
      memberTypeBreakdown[type]++;
    });

    res.json({
      users: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      },
      summary: {
        totalUsers,
        memberTypeBreakdown
      }
    });

  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
};

// Get user analytics and statistics
exports.getUserAnalytics = async (req, res) => {
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

    // Get total users
    const { count: totalUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

    // Get new users in date range
    const { count: newUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());

    // Get users by member type
    const { data: usersByType } = await supabase
      .from('User')
      .select('memberType');

    const memberTypeBreakdown = {};
    if (usersByType) {
      usersByType.forEach(user => {
        const type = user.memberType || 'regular';
        if (!memberTypeBreakdown[type]) {
          memberTypeBreakdown[type] = 0;
        }
        memberTypeBreakdown[type]++;
      });
    }

    // Get users with bookings
    const { data: usersWithBookings } = await supabase
      .from('User')
      .select('id')
      .in('id', supabase
        .from('Booking')
        .select('userId')
        .not('userId', 'is', null)
      );

    const activeUsers = usersWithBookings ? usersWithBookings.length : 0;

    // Daily user registration trends
    const dailyTrends = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyTrends[dateKey] = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get daily user counts
    const { data: dailyUsers } = await supabase
      .from('User')
      .select('createdAt')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());

    if (dailyUsers) {
      dailyUsers.forEach(user => {
        const dateKey = new Date(user.createdAt).toISOString().split('T')[0];
        if (dailyTrends[dateKey]) {
          dailyTrends[dateKey]++;
        }
      });
    }

    res.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: {
        totalUsers: totalUsers || 0,
        newUsers: newUsers || 0,
        activeUsers,
        inactiveUsers: (totalUsers || 0) - activeUsers
      },
      breakdowns: {
        byMemberType: memberTypeBreakdown
      },
      trends: {
        daily: dailyTrends
      }
    });

  } catch (err) {
    console.error('getUserAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
};

// Get user dashboard summary
exports.getUserManagementSummary = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today's new users
    const { count: todayUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', today.toISOString())
      .lt('createdAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    // This month's new users
    const { count: monthUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startOfMonth.toISOString())
      .lte('createdAt', now.toISOString());

    // Total users
    const { count: totalUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

    // Users by member type
    const { data: memberTypeData } = await supabase
      .from('User')
      .select('memberType');

    const memberTypeBreakdown = {};
    if (memberTypeData) {
      memberTypeData.forEach(user => {
        const type = user.memberType || 'regular';
        if (!memberTypeBreakdown[type]) {
          memberTypeBreakdown[type] = 0;
        }
        memberTypeBreakdown[type]++;
      });
    }

    res.json({
      today: {
        newUsers: todayUsers || 0
      },
      thisMonth: {
        newUsers: monthUsers || 0
      },
      total: {
        users: totalUsers || 0
      },
      breakdown: {
        byMemberType: memberTypeBreakdown
      },
      lastUpdated: now.toISOString()
    });

  } catch (err) {
    console.error('getUserManagementSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch user management summary' });
  }
};

// ... existing code ...

// ==================== ADMIN USER VERIFICATION APIs ====================

// Approve/Reject student verification
exports.verifyStudentAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { studentVerificationStatus, rejectionReason } = req.body;

    // Log the request details for debugging
    console.log('verifyStudentAccount request:', {
      userId,
      studentVerificationStatus,
      rejectionReason,
      body: req.body
    });

    // Validate the status
    if (!['VERIFIED', 'REJECTED'].includes(studentVerificationStatus)) {
      return res.status(400).json({ 
        error: 'Invalid verification status. Must be VERIFIED or REJECTED' 
      });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log user details for debugging
    console.log('verifyStudentAccount - User details:', {
      userId,
      memberType: existingUser.memberType,
      memberTypeType: typeof existingUser.memberType,
      hasVerificationImage: !!existingUser.studentVerificationImageUrl,
      verificationImageUrl: existingUser.studentVerificationImageUrl,
      currentVerificationStatus: existingUser.studentVerificationStatus
    });

    // Check if user has uploaded verification document
    if (!existingUser.studentVerificationImageUrl) {
      return res.status(400).json({ 
        error: 'User has not uploaded verification document' 
      });
    }

    // Prepare update data
    const updateData = {
      studentVerificationStatus: studentVerificationStatus,
      studentVerificationDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add rejection reason if status is REJECTED
    if (studentVerificationStatus === 'REJECTED') {
      updateData.studentRejectionReason = rejectionReason || 'Admin rejection - no reason provided';
      updateData.studentVerificationStatus = 'REJECTED';
    } else {
      // If verified, clear any previous rejection reason
      updateData.studentRejectionReason = null;
    }

    // Update user verification status
    console.log('Updating user with data:', updateData);
    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('verifyStudentAccount error:', updateError);
      console.error('Update data that failed:', updateData);
      return res.status(500).json({ 
        error: 'Failed to update verification status',
        details: updateError.message,
        attemptedUpdate: updateData
      });
    }

    // Prepare response
    const response = {
      message: `Account verification ${studentVerificationStatus.toLowerCase()} successfully`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        memberType: updatedUser.memberType,
        studentVerificationStatus: updatedUser.studentVerificationStatus,
        studentVerificationDate: updatedUser.studentVerificationDate,
        studentRejectionReason: updatedUser.studentRejectionReason,
        studentVerificationImageUrl: updatedUser.studentVerificationImageUrl
      },
      verificationDetails: {
        status: updatedUser.studentVerificationStatus,
        date: updatedUser.studentVerificationDate,
        reason: updatedUser.studentRejectionReason
      }
    };

    res.json(response);

  } catch (err) {
    console.error('verifyStudentAccount error:', err);
    res.status(500).json({ error: 'Failed to verify student account', details: err.message });
  }
};

// Delete user (admin)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Log the request details for debugging
    console.log('deleteUser request:', {
      userId,
      body: req.body,
      hasBody: !!req.body,
      bodyType: typeof req.body
    });
    
    // Validate userId parameter
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Safely extract reason from req.body, handle case where req.body might be undefined
    const reason = req.body && req.body.reason ? req.body.reason : 'Admin deletion';

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has any bookings
    const { data: userBookings, error: bookingError } = await supabase
      .from('Booking')
      .select('id')
      .eq('userId', userId);

    if (bookingError) {
      console.error('deleteUser error checking bookings:', bookingError);
      return res.status(500).json({ error: 'Failed to check user bookings' });
    }

    if (userBookings && userBookings.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with existing bookings',
        message: 'Please cancel all user bookings before deleting the account',
        bookingCount: userBookings.length
      });
    }

    // Delete the user
    console.log('Attempting to delete user:', userId);
    const { error: deleteError } = await supabase
      .from('User')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('deleteUser error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    
    console.log('User deleted successfully:', userId);

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        memberType: existingUser.memberType,
        reason: reason
      }
    });

  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
};