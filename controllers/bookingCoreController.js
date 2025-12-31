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
        .select("seatNumbers, startAt, endAt, bookingRef, userId, confirmedPayment, createdAt, refundstatus, status")
        .eq("location", location)
        .in("confirmedPayment", [true, false])
        .neq("refundstatus", "APPROVED") // Exclude refunded bookings from seat availability
        .neq("status", "cancelled") // Exclude cancelled bookings from seat availability
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

// ADMIN: Get detailed booking with related entities (User, Payment, PromoCode, Package)
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

    // Fetch ALL payments related to this booking (original + reschedule payments)
    let allPayments = [];
    if (booking.id || booking.bookingRef) {
      const { sanitizeBookingRef, sanitizeUUID, buildSafeOrQuery } = require("../utils/inputSanitizer");
      const orConditions = [];
      
      if (booking.bookingRef) {
        const sanitizedRef = sanitizeBookingRef(booking.bookingRef);
        if (sanitizedRef) {
          orConditions.push({ field: 'bookingRef', operator: 'eq', value: sanitizedRef });
        }
      }
      
      const sanitizedBookingId = sanitizeUUID(booking.id);
      if (sanitizedBookingId) {
        orConditions.push({ field: 'bookingRef', operator: 'eq', value: `RESCHEDULE_${sanitizedBookingId}` });
        orConditions.push({ field: 'bookingRef', operator: 'eq', value: sanitizedBookingId });
      }
      
      const safeOrQuery = buildSafeOrQuery(orConditions);
      if (safeOrQuery) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('Payment')
          .select('*')
          .or(safeOrQuery)
          .order('createdAt', { ascending: true });
        
        if (!paymentsError && paymentsData && Array.isArray(paymentsData)) {
          // Normalize payment amounts - use amount field or totalAmount field
          allPayments = paymentsData.map(payment => ({
            ...payment,
            amount: payment.amount || payment.totalAmount || 0
          }));
        }
      }
    }

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
        allPayments: allPayments, // All payments including reschedule payments
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

    // Handle search - contain-based matching for bookingRef, location, emails, and user name/email
    let matchingUserIds = [];
    if (search) {
      // Sanitize search input to prevent SQL injection
      const { sanitizeSearchQuery, buildSafeOrQuery, escapePostgREST } = require("../utils/inputSanitizer");
      const sanitizedSearch = sanitizeSearchQuery(search);
      if (sanitizedSearch) {
        // First, search for users matching the search term (contain-based)
        // Search in user name (firstName + lastName), email - contain-based with spaces
        const escapedSearch = escapePostgREST(sanitizedSearch);
        const { data: matchingUsers, error: userSearchError } = await supabase
          .from('User')
          .select('id')
          .or(`email.ilike.%${escapedSearch}%,firstName.ilike.%${escapedSearch}%,lastName.ilike.%${escapedSearch}%`);
        
        if (!userSearchError && matchingUsers && matchingUsers.length > 0) {
          matchingUserIds = matchingUsers.map(u => u.id);
        }
        
        // Build search conditions for booking fields (contain-based)
        const bookingSearchConditions = [
          { field: 'bookingRef', operator: 'ilike', value: `%${sanitizedSearch}%` },
          { field: 'location', operator: 'ilike', value: `%${sanitizedSearch}%` },
          { field: 'bookedForEmails', operator: 'cs', value: `{${sanitizedSearch}}` }
        ];
        
        const bookingOrConditions = buildSafeOrQuery(bookingSearchConditions);
        
        // Combine booking search with user search
        if (matchingUserIds.length > 0 && bookingOrConditions) {
          // Search in booking fields OR userId matches any of the matching users
          // Build combined OR condition: booking fields OR userId matches (contain-based)
          const allConditions = bookingOrConditions.split(',');
          // Add userId conditions for each matching user (individual eq checks)
          matchingUserIds.forEach(userId => {
            // Sanitize userId to prevent injection
            const { sanitizeUUID } = require("../utils/inputSanitizer");
            const sanitizedUserId = sanitizeUUID(userId);
            if (sanitizedUserId) {
              allConditions.push(`userId.eq.${sanitizedUserId}`);
            }
          });
          query = query.or(allConditions.join(','));
        } else if (matchingUserIds.length > 0) {
          // Only user search - use 'in' for better performance when no booking field search
          query = query.in('userId', matchingUserIds);
        } else if (bookingOrConditions) {
          // Only booking fields search (contain-based)
          query = query.or(bookingOrConditions);
        }
      }
    }

    if (status) {
      const now = new Date().toISOString();
      if (status === 'cancelled' || status === 'Cancelled by Admin') {
        // Filter cancelled bookings
        query = query.eq('status', 'cancelled');
        // If specifically looking for admin cancelled, filter by cancelledBy
        if (status === 'Cancelled by Admin') {
          query = query.eq('cancelledBy', 'admin');
        }
      } else if (status === 'upcoming') {
        // Exclude cancelled bookings from upcoming
        query = query.gt('startAt', now).neq('status', 'cancelled');
      } else if (status === 'ongoing') {
        query = query.lte('startAt', now).gt('endAt', now).neq('status', 'cancelled');
      } else if (status === 'completed') {
        query = query.lt('endAt', now).neq('status', 'cancelled');
      } else if (status === 'today') {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
        query = query.gte('startAt', startOfDay).lte('startAt', endOfDay).neq('status', 'cancelled');
      }
    }

    if (location) {
      // Sanitize location to prevent SQL injection
      const { sanitizeString } = require("../utils/inputSanitizer");
      const sanitizedLocation = sanitizeString(location, 100);
      if (sanitizedLocation) {
        query = query.eq('location', sanitizedLocation);
      }
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

      // Check refund status first - if refunded by admin, show "Refunded by Admin"
      // Then check cancelled status
      let calculatedStatus;
      if (booking.refundstatus === 'APPROVED' && booking.refundapprovedby === 'admin') {
        calculatedStatus = 'Refunded by Admin';
      } else if (booking.cancelledBy || booking.status === 'cancelled') {
        // If cancelled by admin, show "Cancelled by Admin" status
        calculatedStatus = booking.cancelledBy === 'admin' ? 'Cancelled by Admin' : 'cancelled';
      } else if (booking.refundstatus === 'APPROVED') {
        // Refunded but not by admin (auto-approved)
        calculatedStatus = 'Refunded';
      } else {
        // Priority: ongoing/today first, then upcoming, then completed
        calculatedStatus = isOngoing ? 'ongoing' : isToday ? 'today' : isUpcoming ? 'upcoming' : 'completed';
      }

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
        status: calculatedStatus,
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

    // Fetch existing booking
    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if startAt or endAt is being modified
    const isTimeModified = updateData.startAt || updateData.endAt;
    let recalculatedData = { ...updateData };

    if (isTimeModified) {
      // Use new times if provided, otherwise use existing
      const newStartAt = updateData.startAt || existingBooking.startAt;
      const newEndAt = updateData.endAt || existingBooking.endAt;
      const location = updateData.location || existingBooking.location;
      const memberType = existingBooking.memberType;

      // Calculate new duration in hours
      const startTime = new Date(newStartAt);
      const endTime = new Date(newEndAt);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      console.log(`📊 Recalculating booking cost:`, {
        bookingId: id,
        oldDuration: ((new Date(existingBooking.endAt) - new Date(existingBooking.startAt)) / (1000 * 60 * 60)).toFixed(2) + 'h',
        newDuration: durationHours.toFixed(2) + 'h',
        location,
        memberType
      });

      // Fetch pricing configuration for this location and member type
      const { data: pricingConfig, error: pricingError } = await supabase
        .from('pricing_configuration')
        .select('*')
        .eq('location', location)
        .eq('memberType', memberType)
        .eq('isActive', true)
        .single();

      if (pricingError || !pricingConfig) {
        console.error('❌ Error fetching pricing configuration:', pricingError);
        return res.status(400).json({
          error: 'Pricing configuration not found for this location and member type'
        });
      }

      // Calculate new total cost based on duration
      let newTotalCost = 0;
      if (durationHours <= 1) {
        // First hour rate
        newTotalCost = parseFloat(pricingConfig.oneHourRate);
      } else {
        // First hour + additional hours
        const additionalHours = durationHours - 1;
        newTotalCost = parseFloat(pricingConfig.oneHourRate) +
          (additionalHours * parseFloat(pricingConfig.overOneHourRate));
      }

      // Multiply by number of people
      const pax = existingBooking.pax || 1;
      newTotalCost = newTotalCost * pax;

      console.log(`💰 New pricing calculation:`, {
        oneHourRate: pricingConfig.oneHourRate,
        overOneHourRate: pricingConfig.overOneHourRate,
        durationHours: durationHours.toFixed(2),
        pax,
        newTotalCost: newTotalCost.toFixed(2)
      });

      // Update recalculated data
      recalculatedData.totalCost = newTotalCost;

      // If totalAmount was not explicitly provided, set it to totalCost
      // (assuming no discounts unless explicitly specified)
      if (!updateData.totalAmount) {
        recalculatedData.totalAmount = newTotalCost;
      }
    }

    // Perform the update
    const { data: updatedBooking, error: updateError } = await supabase
      .from('Booking')
      .update({
        ...recalculatedData,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ Error updating booking:', updateError);
      return res.status(500).json({ error: 'Failed to update booking' });
    }

    // Fetch user data
    let userData = null;
    if (updatedBooking.userId) {
      const { data: user, error: userError } = await supabase
        .from('User')
        .select('id, name, email, firstName, lastName')
        .eq('id', updatedBooking.userId)
        .single();

      if (!userError && user) {
        userData = user;
      }
    }

    // Log booking update activity
    try {
      const changes = [];
      const metadata = {};
      
      // Check what fields were changed
      // Compare dates by converting to ISO strings for accurate comparison
      const existingStartAtISO = existingBooking.startAt ? new Date(existingBooking.startAt).toISOString() : null;
      const updateStartAtISO = updateData.startAt ? new Date(updateData.startAt).toISOString() : null;
      
      if (updateData.startAt && existingStartAtISO !== updateStartAtISO) {
        changes.push('start time');
        metadata.originalStartAt = existingBooking.startAt;
        metadata.newStartAt = updateData.startAt;
      }
      
      const existingEndAtISO = existingBooking.endAt ? new Date(existingBooking.endAt).toISOString() : null;
      const updateEndAtISO = updateData.endAt ? new Date(updateData.endAt).toISOString() : null;
      
      if (updateData.endAt && existingEndAtISO !== updateEndAtISO) {
        changes.push('end time');
        metadata.originalEndAt = existingBooking.endAt;
        metadata.newEndAt = updateData.endAt;
      }
      
      if (updateData.location && existingBooking.location !== updateData.location) {
        changes.push('location');
        metadata.originalLocation = existingBooking.location;
        metadata.newLocation = updateData.location;
      }
      
      if (updateData.specialRequests !== undefined && existingBooking.specialRequests !== updateData.specialRequests) {
        changes.push('special requests');
      }
      
      if (updateData.totalAmount !== undefined && parseFloat(existingBooking.totalAmount) !== parseFloat(updateData.totalAmount)) {
        changes.push('total amount');
        metadata.originalAmount = parseFloat(existingBooking.totalAmount);
        metadata.newAmount = parseFloat(updateData.totalAmount);
      }

      // Only log if there are actual changes
      if (changes.length > 0) {
        const userName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : null;
        
        // Format old and new values for description
        let oldValue = '';
        let newValue = '';
        
        if (metadata.originalStartAt || metadata.originalEndAt || metadata.newStartAt || metadata.newEndAt) {
          // Format dates for description
          const formatDate = (dateStr) => {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleString('en-SG', {
              timeZone: 'Asia/Singapore',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          };
          
          if (metadata.originalStartAt && metadata.originalEndAt) {
            oldValue = `${formatDate(metadata.originalStartAt)} - ${formatDate(metadata.originalEndAt)}`;
          } else if (metadata.originalEndAt) {
            oldValue = `End: ${formatDate(metadata.originalEndAt)}`;
          } else if (metadata.originalStartAt) {
            oldValue = `Start: ${formatDate(metadata.originalStartAt)}`;
          }
          
          if (metadata.newStartAt && metadata.newEndAt) {
            newValue = `${formatDate(metadata.newStartAt)} - ${formatDate(metadata.newEndAt)}`;
          } else if (metadata.newEndAt) {
            newValue = `End: ${formatDate(metadata.newEndAt)}`;
          } else if (metadata.newStartAt) {
            newValue = `Start: ${formatDate(metadata.newStartAt)}`;
          }
        } else if (metadata.originalLocation || metadata.newLocation) {
          oldValue = metadata.originalLocation || '';
          newValue = metadata.newLocation || '';
        } else if (metadata.originalAmount !== undefined || metadata.newAmount !== undefined) {
          oldValue = metadata.originalAmount ? `$${metadata.originalAmount.toFixed(2)}` : '';
          newValue = metadata.newAmount ? `$${metadata.newAmount.toFixed(2)}` : '';
        }

        const activityDescription = oldValue && newValue 
          ? `Old: ${oldValue} → New: ${newValue}`
          : `Modified: ${changes.join(', ')}`;

        await logBookingActivity({
          bookingId: updatedBooking.id,
          bookingRef: updatedBooking.bookingRef,
          activityType: ACTIVITY_TYPES.BOOKING_UPDATED,
          activityTitle: 'Booking Modified by Admin',
          activityDescription: activityDescription,
          userId: updatedBooking.userId,
          userName: userName,
          userEmail: userData?.email || updatedBooking.bookedForEmails?.[0],
          oldValue: oldValue || null,
          newValue: newValue || null,
          metadata: {
            ...metadata,
            changes: changes,
            modifiedBy: 'admin'
          }
        });
        
        console.log('✅ Booking update activity logged successfully');
      }
    } catch (activityError) {
      console.error('❌ Error logging booking update activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    const finalResponse = {
      ...updatedBooking,
      User: userData
    };

    res.json({
      message: 'Booking updated successfully',
      booking: finalResponse,
      recalculated: isTimeModified
    });

  } catch (err) {
  
    res.status(500).json({ error: 'Failed to update booking' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refundAmount, remarks } = req.body;
   
    // Fetch existing booking
    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if already cancelled
    if (existingBooking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    const now = new Date();
    const startAt = new Date(existingBooking.startAt);

    // Allow cancellation of future bookings only (optional - remove if you want to allow past cancellations)
    if (startAt <= now) {
      return res.status(400).json({ error: 'Cannot cancel past or ongoing bookings' });
    }

    // Update booking status to 'cancelled' with all cancellation details
    // Release seats by clearing seatNumbers array
    const updateData = {
      status: 'cancelled',
      cancelledBy: 'admin',
      cancelledAt: now.toISOString(),
      cancellationReason: reason || 'Cancelled by Admin',
      refundAmount: refundAmount || existingBooking.totalAmount,
      remarks: remarks !== undefined && remarks !== null ? remarks : null, // Store admin remarks (allow empty string)
      seatNumbers: [], // Release seats for other users
      updatedAt: now.toISOString()
    };
   
    const { data: cancelledBooking, error: updateError } = await supabase
      .from('Booking')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
       return res.status(500).json({ 
        error: 'Failed to cancel booking',
        details: updateError.message || updateError.code || 'Unknown database error',
        code: updateError.code,
        bookingId: id
      });
    }
    
  
    // Log cancellation activity
    try {
      await logBookingActivity({
        bookingId: existingBooking.id,
        bookingRef: existingBooking.bookingRef,
        activityType: ACTIVITY_TYPES.BOOKING_CANCELLED,
        activityTitle: 'Booking Cancelled by Admin',
        activityDescription: `Booking cancelled by admin. Reason: ${reason || 'No reason provided'}`,
        userId: existingBooking.userId,
        userEmail: existingBooking.bookedForEmails?.[0],
        amount: refundAmount || existingBooking.totalAmount
      });
    } catch (logError) {
      console.error('Error logging cancellation activity:', logError);
      // Don't fail the cancellation if logging fails
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully and seats released',
      booking: cancelledBooking,
      cancelledBooking: {
        id: existingBooking.id,
        bookingRef: existingBooking.bookingRef,
        status: 'cancelled',
        cancelledBy: 'admin',
        reason: reason || 'Cancelled by Admin',
        refundAmount: refundAmount || existingBooking.totalAmount,
        seatNumbers: [] // Seats released (empty array)
      }
    });

  } catch (err) {
  
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

// Delete unpaid booking immediately when payment is cancelled
exports.deleteUnpaidBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    // Fetch existing booking
    const { data: existingBooking, error: fetchError } = await supabase
      .from('Booking')
      .select('id, bookingRef, confirmedPayment, refundstatus, extensionamounts, userId')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only allow deletion of unpaid bookings
    if (existingBooking.confirmedPayment === true) {
      return res.status(400).json({ error: 'Cannot delete confirmed booking' });
    }

    // Don't delete if booking has refunds (except NONE, REQUESTED, REJECTED)
    if (existingBooking.refundstatus && 
        existingBooking.refundstatus !== 'NONE' && 
        existingBooking.refundstatus !== 'REQUESTED' && 
        existingBooking.refundstatus !== 'REJECTED') {
      return res.status(400).json({ error: 'Cannot delete booking with refund status' });
    }

    // Don't delete if booking has extensions
    if (existingBooking.extensionamounts && Object.keys(existingBooking.extensionamounts).length > 0) {
      return res.status(400).json({ error: 'Cannot delete booking with extensions' });
    }

    // Don't delete reschedule/extension payments - only new bookings
    if (existingBooking.bookingRef && 
        (existingBooking.bookingRef.startsWith('RESCHEDULE_') || 
         existingBooking.bookingRef.startsWith('EXTEND_'))) {
      return res.status(400).json({ error: 'Cannot delete reschedule or extension booking' });
    }

    // Check ownership - user can only delete their own bookings
    if (req.user && req.user.id !== existingBooking.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this booking' });
    }

  
    // Step 1: Delete related creditusage records first (to avoid foreign key constraint)
    const { error: creditUsageError } = await supabase
      .from('creditusage')
      .delete()
      .eq('bookingid', existingBooking.id);

    if (creditUsageError) {
      console.error('⚠️  Error deleting creditusage records:', creditUsageError);
      // Continue with booking deletion even if creditusage deletion fails
    } else {
      console.log('✅ Deleted related creditusage records');
    }

    // Step 2: Delete the booking
    const { error: deleteError } = await supabase
      .from('Booking')
      .delete()
      .eq('id', existingBooking.id);

    if (deleteError) {
  
      return res.status(500).json({ error: 'Failed to delete booking' });
    }

    res.json({
      success: true,
      message: 'Unpaid booking deleted successfully',
      bookingRef: existingBooking.bookingRef
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
};

