const { v4: uuidv4 } = require("uuid");
const { logBookingActivity, ACTIVITY_TYPES } = require("../utils/bookingActivityLogger");
const { useCreditsForBooking } = require("../utils/creditHelper");
const supabase = require("../config/database");

exports.createBooking = async (req, res) => {
  try {

    const {
      id, 
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
      packageId, 
      packageUsed 
    } = req.body;

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

    const { data: duplicateBookings, error: duplicateError } = await supabase
      .from("Booking")
      .select("id, bookingRef, startAt, endAt, location, userId")
      .eq("userId", userId)
      .eq("location", location)
      .overlaps("startAt", startAt, "endAt", endAt);

    if (!duplicateError && duplicateBookings && duplicateBookings.length > 0) {
      const isSameBooking = duplicateBookings.some(booking => 
        booking.id === id || 
        (Math.abs(new Date(booking.startAt) - new Date(startAt)) < 60000 &&
         Math.abs(new Date(booking.endAt) - new Date(endAt)) < 60000)
      );

      if (!isSameBooking) {
        return res.status(409).json({
          error: "Duplicate booking detected",
          message: "You already have a booking at this location during this time period",
          existingBookings: duplicateBookings
        });
      }
    }

    if (seatNumbers && seatNumbers.length > 0) {
      console.log(`🔍 Checking seat conflicts for seats: ${seatNumbers.join(', ')}`);
      
      const { data: conflictingBookings, error: seatConflictError } = await supabase
        .from("Booking")
        .select("seatNumbers, startAt, endAt, bookingRef, userId, confirmedPayment, createdAt, refundstatus")
        .eq("location", location)
        .in("confirmedPayment", [true, false])
        .neq("refundstatus", "APPROVED") // Exclude refunded bookings from seat availability
        .lt("startAt", endAt)  
        .gt("endAt", startAt); 

      if (seatConflictError) {
        return res.status(500).json({
          error: "Failed to check seat availability",
          message: "Unable to verify seat availability"
        });
      }

      const allBookedSeats = conflictingBookings
        ?.flatMap(b => b.seatNumbers || [])
        .filter((seat, index, self) => self.indexOf(seat) === index) || [];

      const conflictingSeats = seatNumbers.filter(seat => allBookedSeats.includes(seat));

      if (conflictingSeats.length > 0) {
        const confirmedConflicts = conflictingBookings?.filter(b => 
          b.confirmedPayment && b.seatNumbers?.some(seat => conflictingSeats.includes(seat))
        ) || [];
        
        const pendingConflicts = conflictingBookings?.filter(b => 
          !b.confirmedPayment && b.seatNumbers?.some(seat => conflictingSeats.includes(seat))
        ) || [];

        return res.status(409).json({
          error: "Seat conflict detected",
          message: `The following seats are already booked or reserved during this time: ${conflictingSeats.join(', ')}`,
          conflictingSeats,
          conflictDetails: {
            confirmed: confirmedConflicts.map(b => ({
              bookingRef: b.bookingRef,
              seats: b.seatNumbers,
              startAt: b.startAt,
              endAt: b.endAt
            })),
            pending: pendingConflicts.map(b => ({
              bookingRef: b.bookingRef,
              seats: b.seatNumbers,
              startAt: b.startAt,
              endAt: b.endAt,
              createdAt: b.createdAt
            }))
          },
          availableSeats: allBookedSeats.length > 0 ? 
            ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
              .filter(seat => !allBookedSeats.includes(seat)) : 
            ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
        });
      }

      console.log(`No seat conflicts detected for seats: ${seatNumbers.join(', ')}`);
    }

    if (promoCodeId) {
      const { data: promoCode, error: promoError } = await supabase
        .from("PromoCode")
        .select("id, isactive, code, minimum_hours")
        .eq("id", promoCodeId)
        .eq("isactive", true)
        .single();

      if (promoError || !promoCode) {
        return res.status(400).json({
          error: "Invalid promo code",
          message: "The provided promo code is not valid or inactive"
        });
      }

      if (promoCode.minimum_hours) {
        const startTime = new Date(startAt);
        const endTime = new Date(endAt);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);

        if (durationHours < promoCode.minimum_hours) {
          return res.status(400).json({
            error: "Minimum hours not met",
            message: `This promo code requires a minimum booking duration of ${promoCode.minimum_hours} hours. Your booking is ${durationHours.toFixed(2)} hours.`
          });
        }
      }
    }

    if (confirmedPayment === true && paymentId) {
      const { data: existingPayment, error: paymentCheckError } = await supabase
        .from("Payment")
        .select("id, status")
        .eq("id", paymentId)
        .single();

      if (!paymentCheckError && existingPayment && existingPayment.status === "completed") {
        return res.status(409).json({
          error: "Payment already confirmed",
          message: "This payment has already been confirmed. Cannot create duplicate booking.",
          paymentId: paymentId,
          paymentStatus: existingPayment.status
        });
      }
    }

    const { data, error } = await supabase
      .from("Booking")
      .insert([
        {
          id: id || uuidv4(), 
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
          promocodeid: promoCodeId, 
          discountamount: discountAmount, 
          packageId: packageId,
          packageUsed: packageUsed,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Map database fields to camelCase for consistency
    if (data.promocodeid && !data.promoCodeId) {
      data.promoCodeId = data.promocodeid;
    }
    if (data.discountamount !== undefined && data.discountAmount === undefined) {
      data.discountAmount = data.discountamount;
    }

    // Log booking creation activity
    try {
      await logBookingActivity({
        bookingId: data.id,
        bookingRef: data.bookingRef,
        activityType: ACTIVITY_TYPES.BOOKING_CREATED,
        activityTitle: 'Booking Created',
        activityDescription: `New booking created for ${pax} ${pax > 1 ? 'people' : 'person'} at ${location}`,
        userId: userId,
        userEmail: bookedForEmails?.[0],
        amount: totalCost
      });
    } catch (logError) {
      console.error('Error logging booking creation:', logError);
      // Don't fail booking creation if logging fails
    }

    // Handle credit usage if credits were used
    let creditUsageResult = null;
    if (req.body.creditAmount && req.body.creditAmount > 0) {
      try {
        console.log('💳 Processing credit usage for booking:', {
          bookingId: data.id,
          userId: userId,
          creditAmount: req.body.creditAmount
        });
        
        // Use credits with ORIGINAL_BOOKING action type for discount tracking
        creditUsageResult = await useCreditsForBooking(userId, data.id, req.body.creditAmount, 'ORIGINAL_BOOKING');
        console.log('✅ Credit usage processed:', creditUsageResult);
        
        // Add credit amount to booking data for email/PDF
        data.creditAmount = req.body.creditAmount;

        // Log credit usage activity
        try {
          await logBookingActivity({
            bookingId: data.id,
            bookingRef: data.bookingRef,
            activityType: ACTIVITY_TYPES.CREDIT_USED,
            activityTitle: 'Credits Applied',
            activityDescription: `Credits used for booking payment`,
            userId: userId,
            userEmail: bookedForEmails?.[0],
            amount: req.body.creditAmount
          });
        } catch (logError) {
          console.error('Error logging credit usage:', logError);
        }
      } catch (creditError) {
        console.error('❌ Error processing credit usage:', creditError);
        // Don't fail the booking creation if credit usage fails
        // Just log the error and continue
      }
    }

    // Log promo code application if used
    if (promoCodeId && discountAmount > 0) {
      try {
        await logBookingActivity({
          bookingId: data.id,
          bookingRef: data.bookingRef,
          activityType: ACTIVITY_TYPES.PROMO_APPLIED,
          activityTitle: 'Promo Code Applied',
          activityDescription: `Promo code discount applied`,
          userId: userId,
          userEmail: bookedForEmails?.[0],
          amount: discountAmount
        });
      } catch (logError) {
        console.error('Error logging promo code:', logError);
      }
    }

    // Log package usage if used
    if (packageId && packageUsed) {
      try {
        await logBookingActivity({
          bookingId: data.id,
          bookingRef: data.bookingRef,
          activityType: ACTIVITY_TYPES.PACKAGE_USED,
          activityTitle: 'Package/Pass Used',
          activityDescription: `Booking made using package/pass`,
          userId: userId,
          userEmail: bookedForEmails?.[0]
        });
      } catch (logError) {
        console.error('Error logging package usage:', logError);
      }
    }
   
    res.status(201).json({ 
      message: "Booking created successfully", 
      booking: data,
      promoCodeApplied: !!promoCodeId,
      creditUsage: creditUsageResult
    });
  } catch (err) {
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
      return res.status(404).json({ 
        success: false,
        error: "Booking not found" 
      });
    }

    // Map database fields to camelCase for consistency
    if (data) {
      if (data.promocodeid && !data.promoCodeId) {
        data.promoCodeId = data.promocodeid;
      }
      if (data.discountamount && !data.discountAmount) {
        data.discountAmount = data.discountamount;
      }
      
      // Ensure timestamps are in proper UTC format with 'Z' suffix
      if (data.startAt && !data.startAt.endsWith('Z')) {
        data.startAt = data.startAt + 'Z';
      }
      if (data.endAt && !data.endAt.endsWith('Z')) {
        data.endAt = data.endAt + 'Z';
      }
      if (data.bookedAt && !data.bookedAt.endsWith('Z')) {
        data.bookedAt = data.bookedAt + 'Z';
      }
      if (data.createdAt && !data.createdAt.endsWith('Z')) {
        data.createdAt = data.createdAt + 'Z';
      }
      if (data.updatedAt && !data.updatedAt.endsWith('Z')) {
        data.updatedAt = data.updatedAt + 'Z';
      }
      
      // Fetch discount history for this booking
      const { data: discountHistory, error: discountError } = await supabase
        .from('BookingDiscountHistory')
        .select('*')
        .eq('bookingId', id)
        .order('appliedAt', { ascending: true });
      
      if (!discountError && discountHistory) {
        // Calculate discount summary
        const discountSummary = {
          totalDiscount: 0,
          byType: { CREDIT: 0, PASS: 0, PROMO_CODE: 0 },
          byAction: { ORIGINAL_BOOKING: 0, RESCHEDULE: 0, EXTENSION: 0, MODIFICATION: 0 }
        };
        
        discountHistory.forEach(discount => {
          const amount = parseFloat(discount.discountAmount || 0);
          discountSummary.totalDiscount += amount;
          discountSummary.byType[discount.discountType] = (discountSummary.byType[discount.discountType] || 0) + amount;
          discountSummary.byAction[discount.actionType] = (discountSummary.byAction[discount.actionType] || 0) + amount;
        });
        
        data.discountHistory = discountHistory;
        data.discountSummary = discountSummary;
      }
    }

    res.status(200).json({ 
      success: true,
      booking: data 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error" 
    });
  }
};

exports.getAdminBookingDetails = async (req, res) => {
  try {
    const { idOrRef } = req.params;

    // Try by ID first
    let { data: booking, error: bookingError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', idOrRef)
      .single();

    // If not found by ID, try by bookingRef
    if (bookingError || !booking) {
      const byRef = await supabase
        .from('Booking')
        .select('*')
        .eq('bookingRef', idOrRef)
        .single();
      booking = byRef.data;
      bookingError = byRef.error;
    }

    if (bookingError || !booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Normalize camelCase fields
    if (booking.promocodeid && !booking.promoCodeId) booking.promoCodeId = booking.promocodeid;
    if (booking.discountamount !== undefined && booking.discountAmount === undefined) booking.discountAmount = booking.discountamount;

    // Fetch related entities in parallel
    const [userResp, paymentResp, promoResp, userPassResp, packagePurchaseResp] = await Promise.all([
      booking.userId
        ? supabase.from('User').select('id, email, firstName, lastName, contactNumber, memberType, createdAt, updatedAt').eq('id', booking.userId).single()
        : Promise.resolve({ data: null, error: null }),
      booking.paymentId
        ? supabase.from('Payment').select('*').eq('id', booking.paymentId).single()
        : Promise.resolve({ data: null, error: null }),
      booking.promoCodeId
        ? supabase.from('PromoCode').select('*').eq('id', booking.promoCodeId).single()
        : Promise.resolve({ data: null, error: null }),
      booking.packageId
        ? supabase.from('UserPass').select('*').eq('id', booking.packageId).single()
        : Promise.resolve({ data: null, error: null }),
      booking.packageId
        ? supabase.from('PackagePurchase').select('*').eq('id', booking.packageId).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // User aggregates by userId
    let userStats = null;
    let recentBookings = [];
    if (booking.userId) {
      const aggResp = await supabase
        .from('Booking')
        .select('id,totalAmount,startAt,bookingRef', { count: 'exact' })
        .eq('userId', booking.userId)
        .order('startAt', { ascending: false });

      if (!aggResp.error && Array.isArray(aggResp.data)) {
        const totalSpent = aggResp.data.reduce((sum, b) => sum + (parseFloat(b.totalAmount) || 0), 0);
        const lastBookingAt = aggResp.data[0]?.startAt || null;
        userStats = {
          totalBookings: aggResp.count || aggResp.data.length,
          totalSpent,
          lastBookingAt,
        };
        recentBookings = aggResp.data.slice(0, 5);
      }
    }

    // If user not found by id, try by primary booked email
    let userData = userResp ? userResp.data : null;
    if (!userData && Array.isArray(booking.bookedForEmails) && booking.bookedForEmails.length > 0) {
      const email = booking.bookedForEmails[0];
      const byEmail = await supabase
        .from('User')
        .select('id, email, firstName, lastName, contactNumber, memberType, createdAt, updatedAt')
        .ilike('email', email)
        .single();
      if (!byEmail.error) {
        userData = byEmail.data;
      }
    }

    // Prefer whichever package table returned data
    const packageInfo = userPassResp && userPassResp.data ? userPassResp.data : (packagePurchaseResp && packagePurchaseResp.data ? packagePurchaseResp.data : null);

    // Fetch package name from Package table if packageInfo exists and has packageId
    let packageName = null;
    if (packageInfo && packageInfo.packageId) {
      const { data: packageData, error: packageError } = await supabase
        .from('Package')
        .select('id, name')
        .eq('id', packageInfo.packageId)
        .single();
      
      if (!packageError && packageData) {
        packageName = packageData.name;
      }
    }

    // Add package name to packageInfo if available
    const packageWithName = packageInfo ? { ...packageInfo, packageName } : null;

    // Fetch discount history for this booking
    let discountHistory = [];
    let packageDiscount = 0;
    if (booking.id) {
      const { data: discountData, error: discountError } = await supabase
        .from('BookingDiscountHistory')
        .select('*')
        .eq('bookingId', booking.id)
        .order('appliedAt', { ascending: true });
      
      if (!discountError && discountData) {
        discountHistory = discountData;
        // Calculate package discount (discountType === 'PASS')
        packageDiscount = discountData
          .filter(d => d.discountType === 'PASS')
          .reduce((sum, d) => sum + (parseFloat(d.discountAmount) || 0), 0);
      }
    }

    // Calculate payment fees
    // Payment fee = (totalCost - discountAmount) - totalAmount
    // This represents the fees charged on top of the base cost after discounts
    const baseAmount = parseFloat(booking.totalCost) || 0;
    const totalDiscount = parseFloat(booking.discountAmount) || 0;
    const finalAmount = parseFloat(booking.totalAmount) || 0;
    const paymentFee = Math.max(0, finalAmount - (baseAmount - totalDiscount));

    return res.status(200).json({
      success: true,
      data: {
        booking,
        user: userData,
        payment: paymentResp ? paymentResp.data : null,
        promoCode: promoResp ? promoResp.data : null,
        package: packageWithName,
        discountHistory,
        packageDiscount,
        paymentFee,
        userStats,
        recentBookings,
      },
    });
  } catch (err) {
    console.error('❌ Error in getAdminBookingDetails:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

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
      seatNumbers,
      sortBy = 'startAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 getAllBookings called with params:', {
      page, limit, search, status, location, dateFrom, dateTo, memberType, paymentStatus, seatNumbers, sortBy, sortOrder
    });

    let query = supabase
      .from('Booking')
      .select('*', { count: 'exact' });

    if (search) {
      // Search by bookingRef, location, or user email (bookedForEmails)
      query = query.or(`bookingRef.ilike.%${search}%,location.ilike.%${search}%,bookedForEmails.cs.{${search}}`);
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

    // Date filtering
    if (seatNumbers && dateFrom && dateTo) {
      // When filtering specific seat within a time slot, use overlap logic:
      // booking.startAt < dateTo AND booking.endAt > dateFrom
      query = query.lt('startAt', dateTo).gt('endAt', dateFrom);
    } else {
      if (dateFrom) {
        query = query.gte('startAt', dateFrom);
      }
      if (dateTo) {
        query = query.lte('startAt', dateTo);
      }
    }

    if (memberType) {
      query = query.eq('memberType', memberType);
    }

    if (paymentStatus) {
      if (paymentStatus === 'paid') {
        query = query.or('confirmedPayment.eq.true,refundstatus.eq.APPROVED'); // Include confirmed payments AND refunded bookings
      } else if (paymentStatus === 'unpaid') {
        query = query.eq('confirmedPayment', false).neq('refundstatus', 'APPROVED'); // Exclude refunded bookings from unpaid
      }
    }

    if (seatNumbers) {
      // Filter bookings that contain the specified seat number
      query = query.contains('seatNumbers', [seatNumbers]);
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    console.log('🔍 Pagination calculation:', { page: pageNum, limitNum, offset, range: `${offset} to ${offset + limitNum - 1}` });
    query = query.range(offset, offset + limitNum - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
    }

    // Map database fields to camelCase for consistency
    bookings.forEach(booking => {
      if (booking.promocodeid && !booking.promoCodeId) {
        booking.promoCodeId = booking.promocodeid;
      }
      if (booking.discountamount !== undefined && booking.discountAmount === undefined) {
        booking.discountAmount = booking.discountamount;
      }
    });

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

    const now = new Date();
    const bookingsWithStatus = bookings.map(booking => {
      // Ensure UTC timestamps have 'Z' suffix for proper timezone handling
      const startAtUTC = booking.startAt.endsWith('Z') ? booking.startAt : booking.startAt + 'Z';
      const endAtUTC = booking.endAt.endsWith('Z') ? booking.endAt : booking.endAt + 'Z';
      
      const startAt = new Date(startAtUTC);
      const endAt = new Date(endAtUTC);
      
      const isOngoing = startAt <= now && endAt > now;
      const isToday = startAt.toDateString() === now.toDateString();
      const isCompleted = endAt <= now;
      const isUpcoming = !isOngoing && !isToday && startAt > now;
      
      const durationMs = endAt.getTime() - startAt.getTime();
      const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 100) / 100;
      
      let timeUntilBooking = null;
      if (isUpcoming) {
        const remainingMs = startAt.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        timeUntilBooking = `${remainingHours}h ${remainingMinutes}m`;
      }

      const user = booking.userId ? userData[booking.userId] : null;
      const promoCode = booking.promoCodeId ? promoCodeData[booking.promoCodeId] : null;

      return {
        ...booking,
        startAt: startAtUTC,  // Return with UTC suffix
        endAt: endAtUTC,      // Return with UTC suffix
        isUpcoming,
        isOngoing,
        isCompleted,
        isToday,
        durationHours,
        timeUntilBooking,
        // Priority: ongoing/today first, then upcoming, then completed
        status: isOngoing ? 'ongoing' : isToday ? 'today' : isUpcoming ? 'upcoming' : 'completed',
        User: user,
        PromoCode: promoCode
      };
    });

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

    console.log('🔍 Response data:', {
      bookingsCount: bookingsWithStatus.length,
      totalBookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalBookings,
        totalPages: Math.ceil(totalBookings / limit)
      }
    });

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
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

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
      return res.status(500).json({ error: 'Failed to update booking' });
    }

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
      return res.status(500).json({ error: 'Failed to update booking' });
    }

    res.json({
      message: 'Booking updated successfully',
      booking: finalResponse
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refundAmount } = req.body;

    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const now = new Date();
    const startAt = new Date(existingBooking.startAt);
    
    if (startAt <= now) {
      return res.status(400).json({ error: 'Cannot cancel past or ongoing bookings' });
    }

    const { error: deleteError } = await supabase
      .from('Booking')
      .delete()
      .eq('id', id);

    if (deleteError) {
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
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

