const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const { sendBookingConfirmation, sendExtensionConfirmation } = require("../utils/email");
const { applyPromoCodeToBooking } = require("./promoCodeController");
const { handlePackageUsage, calculateExcessCharge } = require("../utils/packageUsageHelper");
const { 
  validatePassUsage, 
  applyPassToBooking, 
  getUserPassBalance 
} = require("./countBasedPackageController");
const { 
  calculatePaymentAfterCredits, 
  useCreditsForBooking 
} = require("../utils/creditHelper");
const { logBookingActivity, ACTIVITY_TYPES } = require("../utils/bookingActivityLogger");

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

exports.confirmBookingPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

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

    if (existingBooking.confirmedPayment === true || existingBooking.confirmedPayment === "true") {
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
        alreadyConfirmed: true, 
        requestedBookingId: bookingId
      });
    }

    if (existingBooking.paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from("Payment")
        .select("*")
        .eq("id", existingBooking.paymentId)
        .single();

      if (!paymentError && payment && payment.status === "completed") {
        const { data: updatedBooking, error: updateError } = await supabase
          .from("Booking")
          .update({
            confirmedPayment: true,
            updatedAt: new Date().toISOString()
          })
          .eq("id", bookingId)
          .select()
          .single();

        if (updateError) {
          return res.status(500).json({ error: "Failed to update booking" });
        }

        
        return res.json({
          success: true,
          message: "Booking confirmed successfully (payment was already completed)",
          booking: updatedBooking,
          payment: payment,
          alreadyHadPayment: true
        });
      }
    }

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
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Booking not found" });
    }

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

    let promoCodeData = null;
    if (data.promocodeid) {
      const { data: promoCode, error: promoError } = await supabase
        .from("PromoCode")
        .select("code, name, description, discounttype, discountvalue")
        .eq("id", data.promocodeid)
        .single();

      if (!promoError && promoCode) {
        promoCodeData = promoCode;
        data.promoCode = promoCode.code;
        data.promoCodeName = promoCode.name;
        data.promoCodeDescription = promoCode.description;
        data.promoCodeType = promoCode.discounttype;
        data.promoCodeValue = promoCode.discountvalue;
        
        // Map database fields to camelCase for invoice generation
        data.promoCodeId = data.promocodeid;
        data.discountAmount = data.discountamount;
      }
    }
    
    // Map database fields to camelCase even if promo code lookup fails
    if (data.promocodeid && !data.promoCodeId) {
      data.promoCodeId = data.promocodeid;
    }
    if (data.discountamount && !data.discountAmount) {
      data.discountAmount = data.discountamount;
    }

    if (data.promocodeid && data.discountamount && data.discountamount > 0) {
      try {
        const promoResult = await applyPromoCodeToBooking(
          data.promocodeid,
          data.userId,
          data.id,
          data.totalCost
        );

        if (promoResult.success) {
          console.log(`Promo code ${promoResult.promoCode.code} usage recorded and count updated`);
        } else {
          console.error("Error recording promo code usage:", promoResult.error);
        }
      } catch (promoError) {
        console.error("Error recording promo code usage:", promoError);
      }
    }

 
    if (data.packageId && data.packageUsed) {
      // Package usage will be handled in confirmBookingPayment function
      // to avoid double counting when payment is confirmed
      console.log(`📦 Package usage will be handled during payment confirmation`);
    } else {
      console.log(`\n ==== PACKAGE USAGE SKIPPED =====`);
    }

    const userData = {
      name: "Customer", 
      email: data.bookedForEmails?.[0]
    };

    if (paymentData) {
     
      data.paymentMethod = paymentData.paymentMethod || null;
      data.paymentDetails = paymentData;
    }

    // Handle package usage if package was used
    let packageUsageResult = null;
    if (data.packageId && data.packageUsed) {
      try {
        console.log(`\n🎯 ===== PACKAGE USAGE ON PAYMENT CONFIRMATION =====`);
        console.log(`📋 Booking ID: ${data.id}`);
        console.log(`📋 User ID: ${data.userId}`);
        console.log(`📋 Package ID: ${data.packageId}`);
        console.log(`📋 Package Used: ${data.packageUsed}`);

        // Calculate hours used from booking duration
        const startTime = new Date(data.startAt);
        const endTime = new Date(data.endAt);
        const hoursUsed = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
        console.log(`📦 Hours Used: ${hoursUsed}`);
        console.log(`📦 Location: ${data.location}`);
        console.log(`📦 Start Time: ${data.startAt}`);
        console.log(`📦 End Time: ${data.endAt}`);

        // Import the package usage helper
        const { handlePackageUsage } = require('../utils/packageUsageHelper');

        console.log(`📦 Calling handlePackageUsage...`);
        packageUsageResult = await handlePackageUsage(
          data.userId,
          data.packageId,
          hoursUsed,
          data.id,
          data.location,
          data.startAt,
          data.endAt
        );

        console.log(`📦 Package usage result:`, JSON.stringify(packageUsageResult, null, 2));

        if (packageUsageResult.success) {
          console.log(`\n✅ ===== PACKAGE USAGE SUCCESS =====`);
          console.log(`✅ Pass Used: ${packageUsageResult.passUsed}`);
          console.log(`✅ Remaining Count: ${packageUsageResult.remainingCount}`);
          console.log(`✅ Pass Type: ${packageUsageResult.passType}`);
          console.log(`✅ Is Pass Fully Used: ${packageUsageResult.isPassFullyUsed}`);

          // Add package discount info to booking data for PDF generation
          data.packageDiscountId = data.packageId;
          // Calculate actual discount amount (remove card processing fee from totalAmount)
          const { getPaymentSettings } = require('../utils/paymentFeeHelper');
          const feeSettings = await getPaymentSettings();
          const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
          const multiplier = 1 + (cardFeePercentage / 100);
          const baseAmount = data.totalAmount / multiplier; // Remove dynamic % card fee
          data.packageDiscountAmount = data.totalCost - baseAmount; // Calculate actual discount amount
          data.packageName = packageUsageResult.packageName || 'Package';
        } else {
          console.error(`\n❌ ===== PACKAGE USAGE FAILED =====`);
          console.error(`❌ Error: ${packageUsageResult.error}`);
          console.error(`❌ Full result:`, JSON.stringify(packageUsageResult, null, 2));
        }
      } catch (packageError) {
        console.error(`\n❌ ===== PACKAGE USAGE EXCEPTION =====`);
        console.error(`❌ Exception:`, packageError);
        console.error(`❌ Stack:`, packageError.stack);
      }
    } else {
      console.log(`\n⚠️ ===== PACKAGE USAGE SKIPPED =====`);
      console.log(`⚠️ Reason: packageId=${data.packageId}, packageUsed=${data.packageUsed}`);
    }
    console.log(`🎯 ===== END PACKAGE USAGE CHECK =====\n`);

    // Fetch package discount information if package was used
    if (data.packageId || data.packageUsed) {
      try {
        console.log('📦 Fetching package usage for booking:', data.id);
        const { data: packageUsage, error: packageError } = await supabase
          .from('BookingPassUse')
          .select('*')
          .eq('bookingId', data.id);
        
        console.log('📦 Package usage query result:', { packageUsage, packageError });
        
        if (!packageError && packageUsage && packageUsage.length > 0) {
          const packageUse = packageUsage[0];
          console.log('📦 Package use details:', packageUse);
          
          // Get package information using the userPassId from BookingPassUse
          if (packageUse.userPassId) {
            try {
              const { data: userPass, error: userPassError } = await supabase
                .from('UserPass')
                .select(`
                  id,
                  Package (
                    id,
                    name,
                    packageType
                  )
                `)
                .eq('id', packageUse.userPassId)
                .single();
              
              if (!userPassError && userPass) {
                data.packageDiscountId = userPass.id;
                
                // Calculate discount amount based on package hoursAllowed (only for 1 person)
                const totalBookingHours = packageUse.minutesApplied / 60;
                
                // Get package hoursAllowed from Package table
                const packageHoursAllowed = userPass.Package?.hoursAllowed || 8; // Default 8 hours
                
                // Package discount applies to only 1 person's hours (not all people)
                const discountHours = Math.min(totalBookingHours, packageHoursAllowed);
                
                let hourlyRate = 6; // Default for MEMBER
                if (data.memberType === 'STUDENT') {
                  hourlyRate = 5;
                } else if (data.memberType === 'TUTOR') {
                  hourlyRate = 4;
                }
                
                // Calculate discount for only 1 person's hours based on hoursAllowed
                data.packageDiscountAmount = discountHours * hourlyRate;
                data.packageName = userPass.Package?.name || 'Package';
                
                // Calculate final amount after package discount
                const originalTotalCost = parseFloat(data.totalCost) || 0;
                const packageDiscount = parseFloat(data.packageDiscountAmount) || 0;
                
                // If package covers all hours (full day), user pays zero
                if (discountHours >= totalBookingHours) {
                    data.totalAmount = 0; // Full package coverage - user pays nothing
                } else {
                    // Partial package coverage - user pays for remaining hours
                    const remainingHours = totalBookingHours - discountHours;
                    const remainingCost = remainingHours * hourlyRate;
                    data.totalAmount = Math.max(0, remainingCost);
                }
                
                console.log('📦 Package discount info added to booking data:', {
                  packageDiscountId: data.packageDiscountId,
                  packageDiscountAmount: data.packageDiscountAmount,
                  packageName: data.packageName,
                  totalBookingHours: totalBookingHours,
                  packageHoursAllowed: packageHoursAllowed,
                  discountHours: discountHours,
                  hourlyRate: hourlyRate,
                  memberType: data.memberType,
                  originalTotalCost: originalTotalCost,
                  finalAmount: data.totalAmount
                });
              }
            } catch (userPassError) {
              console.error('❌ Error fetching UserPass:', userPassError);
            }
          }
        } else {
          console.log('📦 No package usage found or error:', packageError);
          
          // Fallback: Calculate discount from booking data if package usage not found
          if (data.packageId && data.packageUsed) {
            try {
              console.log('📦 Using fallback method to calculate package discount');
              
              // Get package information directly
              const { data: userPass, error: userPassError } = await supabase
                .from('UserPass')
                .select(`
                  id,
                  Package (
                    id,
                    name,
                    packageType
                  )
                `)
                .eq('id', data.packageId)
                .single();
              
              if (!userPassError && userPass) {
                console.log('📦 UserPass found:', userPass);
                
                data.packageDiscountId = userPass.id;
                data.packageName = userPass.Package?.name || 'Package';
                
                // Calculate discount based on package hoursAllowed (only for 1 person)
                const startTime = new Date(data.startAt);
                const endTime = new Date(data.endAt);
                const totalBookingHours = (endTime - startTime) / (1000 * 60 * 60);
                
                // Get package hoursAllowed from Package table
                const packageHoursAllowed = userPass.Package?.hoursAllowed || 8; // Default 8 hours
                
                // Package discount applies to only 1 person's hours (not all people)
                const discountHours = Math.min(totalBookingHours, packageHoursAllowed);
                
                let hourlyRate = 6; // Default for MEMBER
                if (data.memberType === 'STUDENT') {
                  hourlyRate = 5;
                } else if (data.memberType === 'TUTOR') {
                  hourlyRate = 4;
                }
                
                // Calculate discount for only 1 person's hours based on hoursAllowed
                data.packageDiscountAmount = discountHours * hourlyRate;
                
                // Calculate final amount after package discount
                const originalTotalCost = parseFloat(data.totalCost) || 0;
                const packageDiscount = parseFloat(data.packageDiscountAmount) || 0;
                
                // If package covers all hours (full day), user pays zero
                if (discountHours >= totalBookingHours) {
                    data.totalAmount = 0; // Full package coverage - user pays nothing
                } else {
                    // Partial package coverage - user pays for remaining hours
                    const remainingHours = totalBookingHours - discountHours;
                    const remainingCost = remainingHours * hourlyRate;
                    data.totalAmount = Math.max(0, remainingCost);
                }
                
                console.log('📦 Fallback package discount calculated:', {
                  packageDiscountId: data.packageDiscountId,
                  packageDiscountAmount: data.packageDiscountAmount,
                  packageName: data.packageName,
                  totalBookingHours: totalBookingHours,
                  packageHoursAllowed: packageHoursAllowed,
                  discountHours: discountHours,
                  hourlyRate: hourlyRate,
                  memberType: data.memberType,
                  originalTotalCost: originalTotalCost,
                  finalAmount: data.totalAmount
                });
              } else {
                console.log('📦 UserPass not found, using simple calculation');
                
                // The packageId from frontend is actually PackagePurchase ID
                // We need to find UserPass records that belong to this PackagePurchase
                console.log('📦 Looking for UserPass records for PackagePurchase ID:', data.packageId);
                const { data: userPasses, error: userPassesError } = await supabase
                  .from("UserPass")
                  .select("*, PackagePurchase(*, Package(*))")
                  .eq("packagepurchaseid", data.packageId)
                  .eq("userId", data.userId)
                  .eq("status", "ACTIVE")
                  .gt("remainingCount", 0)
                  .limit(1);
                
                if (userPassesError || !userPasses || userPasses.length === 0) {
                  console.error('❌ Error fetching UserPass records:', userPassesError);
                  
                  // Debug: List all UserPass records to see what's available
                  console.log('📦 Available UserPass records:');
                  const { data: allUserPasses, error: allUserPassesError } = await supabase
                    .from("UserPass")
                    .select("id, userId, packagepurchaseid, passtype, hours, status, remainingCount")
                    .eq("userId", data.userId)
                    .limit(10);
                  
                  if (!allUserPassesError && allUserPasses) {
                    console.log('📦 UserPass records for user:', allUserPasses);
                  }
                  
                  return res.status(400).json({ 
                    error: "No active UserPass found for this PackagePurchase",
                    packagePurchaseId: data.packageId,
                    userId: data.userId,
                    availableUserPasses: allUserPasses || []
                  });
                }
                
                const userPass = userPasses[0]; // Get the first active UserPass
                
                // Get the actual Package data through PackagePurchase
                const packageData = userPass.PackagePurchase?.Package;
                if (!packageData) {
                  console.error('❌ Package data not found in UserPass');
                  return res.status(400).json({ error: "Package data not found" });
                }
                
                console.log('📦 Found UserPass and Package:', {
                  userPassId: data.packageId,
                  packageId: packageData.id,
                  packageName: packageData.name,
                  hoursAllowed: packageData.hoursAllowed
                });
                
                const startTime = new Date(data.startAt);
                const endTime = new Date(data.endAt);
                const totalBookingHours = (endTime - startTime) / (1000 * 60 * 60);
                
                // Use actual package hoursAllowed from database
                const packageHoursAllowed = packageData.hoursAllowed || 4;
                
                // Package applies to individual person hours, not total booking hours
                const individualPersonHours = totalBookingHours; // Hours per person
                
                // Package can only cover hours for ONE person, not all people
                const appliedHours = Math.min(individualPersonHours, packageHoursAllowed);
                const remainingHours = Math.max(0, individualPersonHours - appliedHours);
                
                // Get pricing from database for accurate rates
                const { data: pricingData, error: pricingError } = await supabase
                  .from("pricing_configuration")
                  .select("*")
                  .eq("location", data.location)
                  .eq("memberType", data.memberType)
                  .eq("isActive", true)
                  .single();
                
                let pricePerHour;
                if (pricingData) {
                  pricePerHour = individualPersonHours <= 1 ? 
                    pricingData.oneHourRate : pricingData.overOneHourRate;
                } else {
                  // Fallback rates
                  if (data.memberType === 'STUDENT') {
                    pricePerHour = individualPersonHours <= 1 ? 4.00 : 3.00;
                  } else if (data.memberType === 'TUTOR') {
                    pricePerHour = individualPersonHours <= 1 ? 6.00 : 5.00;
                  } else {
                    pricePerHour = individualPersonHours <= 1 ? 5.00 : 4.00;
                  }
                }
                
                data.packageDiscountId = data.packageId;
                data.packageDiscountAmount = appliedHours * pricePerHour; // Discount for 1 person
                data.packageName = packageData.name || 'Package Applied';
                
                // Calculate final amount after package discount (matching frontend logic)
                const originalTotalCost = parseFloat(data.totalCost) || 0;
                let finalAmount = 0;
                
                // If package covers all hours (full day), user pays zero for the person with package
                if (appliedHours >= individualPersonHours && individualPersonHours > 0) {
                  // Full package coverage - user pays nothing for the person with package
                  // But other people still pay full price
                  const packagePersonCost = individualPersonHours * pricePerHour;
                  const otherPeopleCost = originalTotalCost - packagePersonCost;
                  finalAmount = Math.max(0, otherPeopleCost);
                } else {
                  // Partial package coverage - user pays for remaining hours for the person with package
                  // Plus full cost for other people
                  const remainingCostForPackagePerson = remainingHours * pricePerHour;
                  const packagePersonCost = individualPersonHours * pricePerHour;
                  const otherPeopleCost = originalTotalCost - packagePersonCost;
                  finalAmount = Math.max(0, remainingCostForPackagePerson + otherPeopleCost);
                }
                
                data.totalAmount = finalAmount;
                
                console.log('📦 Package discount calculated (matching frontend):', {
                  packageDiscountId: data.packageDiscountId,
                  packageDiscountAmount: data.packageDiscountAmount,
                  packageName: data.packageName,
                  totalBookingHours: totalBookingHours,
                  individualPersonHours: individualPersonHours,
                  packageHoursAllowed: packageHoursAllowed,
                  appliedHours: appliedHours,
                  remainingHours: remainingHours,
                  pricePerHour: pricePerHour,
                  originalTotalCost: originalTotalCost,
                  finalAmount: data.totalAmount,
                  memberType: data.memberType
                });
              }
            } catch (fallbackError) {
              console.error('❌ Error in fallback package calculation:', fallbackError);
            }
          }
        }
      } catch (packageFetchError) {
        console.error('❌ Error fetching package usage:', packageFetchError);
      }
    }

    // Handle credit amount - if discountamount exists and no promo code, treat as credit
    if (data.discountamount && data.discountamount > 0 && !data.promoCodeId && !data.promocodeid) {
      data.creditAmount = data.discountamount;
      console.log('💳 Credit amount from discountamount field:', data.creditAmount);
    }

    // Log booking confirmation data
    console.log('📧 Sending booking confirmation for booking:', data.id);
    console.log('📧 Booking data for email/PDF generation:', {
      packageDiscountAmount: data.packageDiscountAmount,
      packageName: data.packageName,
      packageDiscountId: data.packageDiscountId,
      creditAmount: data.creditAmount,
      totalCost: data.totalCost,
      totalAmount: data.totalAmount,
      discountAmount: data.discountAmount,
      promoCodeId: data.promoCodeId
    });

    await sendBookingConfirmation(userData, data);

    res.status(200).json({
      message: "Payment confirmed & confirmation email sent successfully",
      booking: data,
      payment: paymentData,
      promoCode: promoCodeData,
      totalAmount: data.totalAmount,
      confirmedPayment: data.confirmedPayment,
      packageUsage: packageUsageResult
    });
  } catch (err) {
    console.error("confirmBookingPayment error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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


exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.body;
    const {
      page = 1,
      limit = 1000,
      status,
      paymentStatus,
      sortBy = 'startAt',
      sortOrder = 'desc'
    } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    let query = supabase
      .from('Booking')
      .select('*', { count: 'exact' })
      .eq('userId', userId)
      .or('confirmedPayment.eq.true,refundstatus.eq.APPROVED,extensionamounts.not.is.null') // Include confirmed payments, refunded bookings, AND extension bookings
      .is('deletedAt', null); // Exclude deleted bookings 

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

    if (paymentStatus) {
      if (paymentStatus === 'paid') {
        query = query.or('confirmedPayment.eq.true,refundstatus.eq.APPROVED'); // Include confirmed payments AND refunded bookings
      } else if (paymentStatus === 'unpaid') {
        query = query.eq('confirmedPayment', false).neq('refundstatus', 'APPROVED'); // Exclude refunded bookings from unpaid
      }
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch user bookings', details: error.message });
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

    // Fetch payment methods for bookings with paymentId
    const paymentIds = bookings
      .filter(b => b.paymentId)
      .map(b => b.paymentId);
    
    let paymentMethodData = {};
    if (paymentIds.length > 0) {
      const { data: payments, error: paymentError } = await supabase
        .from('Payment')
        .select('id, paymentMethod')
        .in('id', paymentIds);
      
      if (!paymentError && payments) {
        payments.forEach(payment => {
          paymentMethodData[payment.id] = payment.paymentMethod;
        });
      }
    }

    // Fetch discount history for all bookings
    const bookingIds = bookings.map(b => b.id);
    let discountHistoryData = {};
    
    if (bookingIds.length > 0) {
      const { data: discountHistory, error: discountError } = await supabase
        .from('BookingDiscountHistory')
        .select('*')
        .in('bookingId', bookingIds)
        .order('appliedAt', { ascending: true });
      
      if (!discountError && discountHistory) {
        // Group by bookingId
        discountHistory.forEach(discount => {
          if (!discountHistoryData[discount.bookingId]) {
            discountHistoryData[discount.bookingId] = [];
          }
          discountHistoryData[discount.bookingId].push(discount);
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
      
      const isRefunded = booking.refundstatus === 'APPROVED';
      const isCancelled = booking.deletedAt !== null;
      const isOngoing = !isCancelled && !isRefunded && startAt <= now && endAt > now;
      const isToday = !isCancelled && !isRefunded && startAt.toDateString() === now.toDateString();
      const isCompleted = !isCancelled && !isRefunded && endAt <= now;
      const isUpcoming = !isCancelled && !isRefunded && !isOngoing && !isToday && startAt > now;
      
      const durationMs = endAt.getTime() - startAt.getTime();
      const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 100) / 100;
      
      let timeUntilBooking = null;
      if (isUpcoming) {
        const remainingMs = startAt.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        timeUntilBooking = `${remainingHours}h ${remainingMinutes}m`;
      }

      const promoCode = booking.promoCodeId ? promoCodeData[booking.promoCodeId] : null;
      const paymentMethod = booking.paymentId ? paymentMethodData[booking.paymentId] : null;
      const discountHistory = discountHistoryData[booking.id] || [];
      
      // Calculate total discounts by type and action from discount history
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
        status: isRefunded ? 'refunded' : isCancelled ? 'cancelled' : isOngoing ? 'ongoing' : isToday ? 'today' : isUpcoming ? 'upcoming' : 'completed',
        PromoCode: promoCode,
        paymentMethod: paymentMethod,
        // Add discount tracking data
        discountHistory: discountHistory,
        discountSummary: discountSummary
      };
    });

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
    res.status(500).json({ error: 'Failed to fetch user bookings', details: err.message });
  }
};

// Get booking payment details for refund calculation
exports.getBookingPaymentDetails = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    // Get booking details with all discount information
    const { data: booking, error: bookingError } = await supabase
      .from('Booking')
      .select('id, totalAmount, totalCost, discountamount, packageId, packageUsed, paymentId, bookingRef, promocodeid, promoCodeId')
      .eq('id', bookingId)
      .single();


    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    let paymentAmount = parseFloat(booking.totalAmount) || 0;
    let paymentMethod = 'Unknown';
    const totalCost = parseFloat(booking.totalCost) || 0;
    
    // Determine if discountamount is promo code or credit
    let promoDiscountAmount = 0;
    console.log('🔍 Checking promo code detection:', {
      discountamount: booking.discountamount,
      promocodeid: booking.promocodeid,
      promoCodeId: booking.promoCodeId,
      hasPromoCode: !!(booking.promoCodeId || booking.promocodeid)
    });
    
    if (booking.discountamount && booking.discountamount > 0 && (booking.promoCodeId || booking.promocodeid)) {
      // If there's a promo code, discountamount is promo discount
      promoDiscountAmount = parseFloat(booking.discountamount) || 0;
      console.log('💳 Promo code discount found:', promoDiscountAmount);
    } else {
      console.log('💳 No promo code discount (discountamount will be treated as credit if credits were used)');
    }

    // Get ALL payment details (original + reschedule) for accurate refund calculation
    console.log('🔍 Finding all payments for booking payment details:', {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      paymentId: booking.paymentId
    });

    // First, let's check what payments exist for this booking
    // Try multiple query patterns to find all related payments
    const { data: allPaymentsCheck, error: checkError } = await supabase
      .from('Payment')
      .select('id, totalAmount, cost, paymentMethod, bookingRef, createdAt')
      .or(`bookingRef.eq.${booking.bookingRef},bookingRef.eq.RESCHEDULE_${booking.id},bookingRef.eq.${booking.id}`)
      .order('createdAt', { ascending: true });

    console.log('🔍 All payments found for booking:', allPaymentsCheck);
    console.log('🔍 Query used:', `bookingRef.eq.${booking.bookingRef},bookingRef.eq.RESCHEDULE_${booking.id},bookingRef.eq.${booking.id}`);

    // Also try a broader search to see all payments
    const { data: allPaymentsBroader, error: broaderError } = await supabase
      .from('Payment')
      .select('id, totalAmount, cost, paymentMethod, bookingRef, createdAt')
      .ilike('bookingRef', `%${booking.bookingRef}%`)
      .order('createdAt', { ascending: true });

    console.log('🔍 Broader search results:', allPaymentsBroader);

    // Use the broader search results if the specific query didn't find multiple payments
    const allPayments = (allPaymentsCheck && allPaymentsCheck.length > 1) ? allPaymentsCheck : allPaymentsBroader;
    const paymentsError = checkError;

    if (allPayments && !paymentsError && allPayments.length > 0) {
      console.log('📊 Found payments for booking payment details:', allPayments.map(p => ({
        id: p.id,
        bookingRef: p.bookingRef,
        amount: p.totalAmount || p.cost,
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt
      })));

      // Sum up all payments
      paymentAmount = allPayments.reduce((sum, payment) => {
        const amount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
        return sum + amount;
      }, 0);

      // Use the payment method from the most recent payment
      const latestPayment = allPayments[allPayments.length - 1];
      paymentMethod = latestPayment.paymentMethod || 'Unknown';

      console.log('💰 Total payment amount for UI:', paymentAmount);
    } else {
      console.log('⚠️ No payments found, using fallback methods...');
      
      // Fallback: try to get payment by paymentId (single payment)
      if (booking.paymentId) {
        const { data: payment, error: paymentError } = await supabase
          .from('Payment')
          .select('totalAmount, cost, paymentMethod')
          .eq('id', booking.paymentId)
          .single();

        if (payment && !paymentError) {
          paymentAmount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
          paymentMethod = payment.paymentMethod || 'Unknown';
          console.log('📊 Fallback: Found single payment by paymentId:', paymentAmount);
        }
      }
    }
    
    // Calculate package discount amount if package was used
    let packageDiscountAmount = 0;
    if (booking.packageUsed && booking.packageId) {
      // First, get the payment amount before card fee to calculate package discount correctly
      let amountBeforeCardFee = paymentAmount;
      const isCardPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('card') || 
         paymentMethod.toLowerCase().includes('credit'));
      
      if (isCardPayment) {
        // If card payment, remove dynamic % fee to get the amount before card fee
        const { getPaymentSettings } = require('../utils/paymentFeeHelper');
        const feeSettings = await getPaymentSettings();
        const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
        const multiplier = 1 + (cardFeePercentage / 100);
        amountBeforeCardFee = paymentAmount / multiplier;
      }
      
      // Package discount = totalCost - amountBeforeCardFee
      packageDiscountAmount = Math.max(0, totalCost - amountBeforeCardFee);
    }
    
    // Find credit usage for this booking to show accurate credit information
    console.log('🔍 Finding credit usage for booking payment details...');
    const { data: creditUsages, error: creditUsageError } = await supabase
      .from('creditusage')
      .select('id, amountused, creditid, usercredits(amount, status)')
      .eq('bookingid', bookingId);

    let creditAmount = 0;
    if (creditUsages && !creditUsageError) {
      creditAmount = creditUsages.reduce((sum, usage) => {
        const amount = parseFloat(usage.amountused) || 0;
        return sum + amount;
      }, 0);
      console.log('💳 Total credits used for this booking:', creditAmount);
    } else {
      console.log('💳 No credit usage found for this booking');
    }

    // Calculate fees based on payment methods (handle multiple payments)
    let cardFee = 0;
    let payNowFee = 0;
    
    // Load payment settings ONCE before loop
    const { getPaymentSettings } = require('../utils/paymentFeeHelper');
    const feeSettings = await getPaymentSettings();
    const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
    const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;
    
    if (allPayments && allPayments.length > 0) {
      console.log('💳 Calculating fees for each payment in UI...');
      
      allPayments.forEach((payment, index) => {
        const paymentAmount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
        const paymentMethod = payment.paymentMethod || '';
        
        const isCardPayment = paymentMethod && 
          (paymentMethod.toLowerCase().includes('card') || 
           paymentMethod.toLowerCase().includes('credit'));
        
        const isPayNowPayment = paymentMethod && 
          (paymentMethod.toLowerCase().includes('paynow') || 
           paymentMethod.toLowerCase().includes('pay_now'));
        
        if (isCardPayment) {
          // Calculate dynamic % card fee for this payment
          const multiplier = 1 + (cardFeePercentage / 100);
          const subtotal = paymentAmount / multiplier;
          const feeForThisPayment = paymentAmount - subtotal;
          cardFee += feeForThisPayment;
          
          console.log(`💳 Card payment ${index + 1} fee:`, {
            amount: paymentAmount,
            fee: feeForThisPayment,
            totalCardFee: cardFee
          });
        } else if (isPayNowPayment && paymentAmount < 10) {
          // PayNow dynamic fee - ONLY for amounts < $10
          payNowFee += paynowFeeAmount;
          
          console.log(`💳 PayNow payment ${index + 1} fee:`, {
            amount: paymentAmount,
            fee: paynowFeeAmount,
            totalPayNowFee: payNowFee
          });
        }
      });
      
      console.log('💳 Total fees calculated:', {
        totalCardFee: cardFee,
        totalPayNowFee: payNowFee,
        totalPaymentAmount: paymentAmount
      });
    } else {
      // Fallback: use original logic for single payment
      const isCardPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('card') || 
         paymentMethod.toLowerCase().includes('credit'));
      
      const isPayNowPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('paynow') || 
         paymentMethod.toLowerCase().includes('pay_now'));
      
      if (isCardPayment) {
        // Use already loaded feeSettings
        const multiplier = 1 + (cardFeePercentage / 100);
        const subtotal = paymentAmount / multiplier;
        cardFee = paymentAmount - subtotal;
      } else if (isPayNowPayment && paymentAmount < 10) {
        // Use already loaded feeSettings - ONLY for amounts < $10
        payNowFee = paynowFeeAmount;
      }
    }

    res.json({
      bookingId: booking.id,
      paymentAmount: paymentAmount,
      paymentMethod: paymentMethod,
      bookingRef: booking.bookingRef,
      promoDiscountAmount: promoDiscountAmount,
      packageDiscountAmount: packageDiscountAmount,
      creditAmount: creditAmount,
      totalDiscountAmount: promoDiscountAmount + packageDiscountAmount + creditAmount,
      cardFee: Math.round(cardFee * 100) / 100, // Round to 2 decimal places
      payNowFee: Math.round(payNowFee * 100) / 100, // Round to 2 decimal places
      totalCost: totalCost,
      refundPolicy: {
        creditsRefundable: false,
        discountsRefundable: false,
        promoCodeRefundable: false,
        policy: 'Credits, discounts, and promo codes are non-refundable'
      }
    });

  } catch (error) {
    console.error('Error getting booking payment details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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

    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .eq('userId', userId)
      .gte('startAt', startDate.toISOString())
      .lte('startAt', endDate.toISOString());

    if (error) {
      console.error('getUserBookingAnalytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch user analytics' });
    }

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.confirmedPayment).length;
    const pendingBookings = totalBookings - confirmedBookings;
    const totalSpent = bookings
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const averageBookingValue = totalBookings > 0 ? totalSpent / totalBookings : 0;

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
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
};

exports.getUserDashboardSummary = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: todayBookings } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId) 
      .gte('startAt', today.toISOString())
      .lt('startAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const { data: monthBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .eq('userId', userId)
      .gte('startAt', startOfMonth.toISOString())
      .lte('startAt', now.toISOString())
      .eq('confirmedPayment', true);

    const monthSpent = monthBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    const { count: upcomingCount } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('confirmedPayment', true) 
      .gt('startAt', now.toISOString());

    const pendingAmount = 0;

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
      .or('confirmedPayment.eq.true,refundstatus.eq.APPROVED') // Include confirmed payments AND refunded bookings
      .gte("startAt", now);

    if (upcomingError) {
      console.error(upcomingError);
      return res.status(400).json({ error: upcomingError.message });
    }

    const { count: pastCount, error: pastError } = await supabase
      .from("Booking")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .or('confirmedPayment.eq.true,refundstatus.eq.APPROVED') // Include confirmed payments AND refunded bookings
      .lt("endAt", now);

    if (pastError) {
      return res.status(400).json({ error: pastError.message });
    }

    res.status(200).json({
      userId,
      upcomingBookings: upcomingCount || 0,
      pastBookings: pastCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
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

    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .gte('startAt', startDate.toISOString())
      .lte('startAt', endDate.toISOString());

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.confirmedPayment).length;
    const pendingBookings = totalBookings - confirmedBookings;
    const totalRevenue = bookings
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

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
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: todayBookings } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .gte('startAt', today.toISOString())
      .lt('startAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const { data: monthBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .gte('startAt', startOfMonth.toISOString())
      .lte('startAt', now.toISOString())
      .eq('confirmedPayment', true);

    const monthRevenue = monthBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    const { count: upcomingCount } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .gt('startAt', now.toISOString());

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
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
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


exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      memberType,
      studentVerificationStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeStats = 'false'
    } = req.query;

    let query = supabase
      .from('User')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (memberType) {
      query = query.eq('memberType', memberType);
    }

    if (studentVerificationStatus) {
      query = query.eq('studentVerificationStatus', studentVerificationStatus);
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }

    let usersWithStats = users;
    if (includeStats === 'true') {
      const userIds = users.map(user => user.id);
      
      const { data: bookingCounts, error: bookingError } = await supabase
        .from('Booking')
        .select('userId, confirmedPayment, totalAmount')
        .in('userId', userIds);

      if (!bookingError && bookingCounts) {
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
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
};

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

    const { count: totalUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

    const { count: newUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());

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

    const { data: usersWithBookings } = await supabase
      .from('User')
      .select('id')
      .in('id', supabase
        .from('Booking')
        .select('userId')
        .not('userId', 'is', null)
      );

    const activeUsers = usersWithBookings ? usersWithBookings.length : 0;

    const dailyTrends = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyTrends[dateKey] = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }

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
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
};

exports.getUserManagementSummary = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: todayUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', today.toISOString())
      .lt('createdAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const { count: monthUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', startOfMonth.toISOString())
      .lte('createdAt', now.toISOString());

    const { count: totalUsers } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

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

exports.verifyStudentAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { studentVerificationStatus, rejectionReason } = req.body;

    console.log('verifyStudentAccount request:', {
      userId,
      studentVerificationStatus,
      rejectionReason,
      body: req.body
    });

    if (!['VERIFIED', 'REJECTED'].includes(studentVerificationStatus)) {
      return res.status(400).json({ 
        error: 'Invalid verification status. Must be VERIFIED or REJECTED' 
      });
    }

    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('verifyStudentAccount - User details:', {
      userId,
      memberType: existingUser.memberType,
      memberTypeType: typeof existingUser.memberType,
      hasVerificationImage: !!existingUser.studentVerificationImageUrl,
      verificationImageUrl: existingUser.studentVerificationImageUrl,
      currentVerificationStatus: existingUser.studentVerificationStatus
    });

    if (!existingUser.studentVerificationImageUrl) {
      return res.status(400).json({ 
        error: 'User has not uploaded verification document' 
      });
    }

    const updateData = {
      studentVerificationStatus: studentVerificationStatus,
      studentVerificationDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (studentVerificationStatus === 'REJECTED') {
      updateData.studentRejectionReason = rejectionReason || 'Admin rejection - no reason provided';
      updateData.studentVerificationStatus = 'REJECTED';
    } else {
      updateData.studentRejectionReason = null;
      // Set verification date to current time when verified
      // This will be used to calculate 6-month expiration
      updateData.studentVerifiedAt = new Date().toISOString();
    }

    // Record verification history before updating
    const historyData = {
      userId: userId,
      previousStatus: existingUser.studentVerificationStatus || 'PENDING',
      newStatus: studentVerificationStatus,
      reason: studentVerificationStatus === 'REJECTED' 
        ? (rejectionReason || 'Admin rejection - no reason provided')
        : (studentVerificationStatus === 'VERIFIED' ? 'Student verification approved' : 'Status changed'),
      changedBy: 'admin', // You can get this from req.user if you have admin auth
      changedAt: new Date().toISOString()
    };

    // Insert into verification history
    const { error: historyError } = await supabase
      .from('VerificationHistory')
      .insert([historyData]);

    if (historyError) {
      console.error('Error recording verification history:', historyError);
      // Don't fail the main operation if history recording fails
    } else {
      console.log('✅ Verification history recorded successfully');
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
     
      return res.status(500).json({ 
        error: 'Failed to update verification status',
        details: updateError.message,
        attemptedUpdate: updateData
      });
    }

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
    res.status(500).json({ error: 'Failed to verify student account', details: err.message });
  }
};

exports.getVerificationExpiry = async (req, res) => {
  try {
    const { userId } = req.params;
    const { getUserVerificationExpiry } = require('../utils/studentVerificationExpiry');
    
    const expiryInfo = await getUserVerificationExpiry(userId);
    
    if (expiryInfo.error) {
      return res.status(404).json({ error: expiryInfo.error });
    }
    
    res.json({
      success: true,
      ...expiryInfo
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to get verification expiry', details: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('deleteUser request:', {
      userId,
      body: req.body,
      hasBody: !!req.body,
      bodyType: typeof req.body
    });
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const reason = req.body && req.body.reason ? req.body.reason : 'Admin deletion';

    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: userBookings, error: bookingError } = await supabase
      .from('Booking')
      .select('id')
      .eq('userId', userId);

    if (bookingError) {
      return res.status(500).json({ error: 'Failed to check user bookings' });
    }

    if (userBookings && userBookings.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with existing bookings',
        message: 'Please cancel all user bookings before deleting the account',
        bookingCount: userBookings.length
      });
    }

    const { error: deleteError } = await supabase
      .from('User')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    
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
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
};

exports.confirmBookingWithPackage = async (req, res) => {
  try {
    const {
      bookingId,
      userId,
      packageId,
      hoursUsed,
      location,
      startTime,
      endTime,
      paymentId
    } = req.body;

    if (!bookingId || !userId || !packageId || !hoursUsed) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "bookingId, userId, packageId, and hoursUsed are required"
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", bookingId)
      .eq("userId", userId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        error: "Booking not found",
        message: "The specified booking does not exist"
      });
    }

    if (booking.confirmedPayment) {
      return res.status(409).json({
        error: "Booking already confirmed",
        message: "This booking has already been confirmed"
      });
    }

    const packageUsageResult = await handlePackageUsage(
      userId,
      packageId,
      hoursUsed,
      bookingId,
      location || booking.location,
      startTime || booking.startAt,
      endTime || booking.endAt
    );

    if (!packageUsageResult.success) {
      return res.status(400).json({
        error: "Package usage failed",
        message: packageUsageResult.error
      });
    }

    let totalAmount = 0;

    const { data: updatedBooking, error: updateError } = await supabase
      .from("Booking")
      .update({
        confirmedPayment: true,
        paymentId: paymentId || "PACKAGE_USED",
        totalAmount: totalAmount,
        packageUsed: packageId,
        packagePassUsed: packageUsageResult.passUsed,
        passType: packageUsageResult.passType,
        remainingCount: packageUsageResult.remainingCount,
        updatedAt: new Date().toISOString()
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        error: "Failed to update booking",
        message: updateError.message
      });
    }

    try {
      const userData = {
        name: "Customer", 
        email: updatedBooking.bookedForEmails?.[0]
      };
      
      // Add package discount information to booking data
      if (packageUsageResult && packageUsageResult.passUsed) {
        updatedBooking.packageDiscountId = packageId;
        updatedBooking.packageDiscountAmount = packageUsageResult.discountAmount || 0;
        updatedBooking.packageName = packageUsageResult.packageType || 'Package';
        console.log('📦 Package discount info added to booking data:', {
          packageDiscountId: updatedBooking.packageDiscountId,
          packageDiscountAmount: updatedBooking.packageDiscountAmount,
          packageName: updatedBooking.packageName
        });
      }
      
      await sendBookingConfirmation(userData, updatedBooking);
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
    }

    res.json({
      success: true,
      message: "Booking confirmed successfully with package usage",
      booking: updatedBooking,
      packageUsage: {
        passUsed: packageUsageResult.passUsed,
        passType: packageUsageResult.passType,
        remainingCount: packageUsageResult.remainingCount,
        packageType: packageUsageResult.packageType,
        totalPasses: packageUsageResult.totalPasses,
        remainingPasses: packageUsageResult.remainingPasses
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    });
  }
};

exports.extendBooking = async (req, res) => {
  try {
    console.log("Extend booking request:", req.body);
    
    const {
      bookingId,
      newEndAt,
      seatNumbers,
      extensionHours,
      extensionCost
    } = req.body;

    if (!bookingId || !newEndAt || !extensionHours || !extensionCost) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "bookingId, newEndAt, extensionHours, and extensionCost are required"
      });
    }

    // Get the current booking
    const { data: booking, error: bookingError } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", bookingId)
      .single();

    console.log("Booking query result:", { booking, bookingError });

    if (bookingError || !booking) {
      return res.status(404).json({
        error: "Booking not found",
        message: "The specified booking does not exist",
        details: bookingError?.message
      });
    }

    // Check if booking is confirmed and paid
    if (!booking.confirmedPayment) {
      return res.status(400).json({
        error: "Cannot extend unpaid booking",
        message: "Only paid bookings can be extended"
      });
    }

    // Validate new end time is after current end time
    const currentEndTime = new Date(booking.endAt);
    const newEndTime = new Date(newEndAt);
    
    if (newEndTime <= currentEndTime) {
      return res.status(400).json({
        error: "Invalid extension time",
        message: "New end time must be after current end time"
      });
    }

    // Check seat availability for the extended time period
    if (seatNumbers && seatNumbers.length > 0) {
      const { data: conflictingBookings, error: conflictError } = await supabase
        .from("Booking")
        .select("id, seatNumbers")
        .eq("location", booking.location)
        .eq("confirmedPayment", true)
        .neq("id", bookingId) // Exclude current booking
        .lt("startAt", newEndAt)
        .gt("endAt", booking.endAt);

      if (conflictError) {
        console.error("Error checking seat conflicts:", conflictError);
        return res.status(500).json({
          error: "Database error",
          message: "Failed to check seat availability",
          details: conflictError.message
        });
      }

      // Check if any of the selected seats are already booked
      const conflictingSeats = [];
      conflictingBookings?.forEach(conflictBooking => {
        if (conflictBooking.seatNumbers) {
          const conflictSeats = conflictBooking.seatNumbers.filter(seat => 
            seatNumbers.includes(seat)
          );
          conflictingSeats.push(...conflictSeats);
        }
      });

      if (conflictingSeats.length > 0) {
        return res.status(400).json({
          error: "Seat conflict",
          message: `Seats ${conflictingSeats.join(', ')} are not available for the extended time`
        });
      }
    }

    // Don't update booking here - wait for payment confirmation
    // Just return success to allow payment flow to continue
    console.log("Extension request validated, proceeding to payment");

    // Return success to allow payment flow to continue
    res.json({
      success: true,
      message: "Extension request validated, proceed to payment",
      extension: {
        hours: extensionHours,
        cost: extensionCost,
        newEndTime: newEndAt
      }
    });

  } catch (error) {
    console.error("Error extending booking:", error);
    res.status(500).json({
      error: "Server error",
      message: "Failed to extend booking"
    });
  }
};

exports.confirmExtensionPayment = async (req, res) => {
  try {
    const { bookingId, paymentId, extensionData } = req.body;

    if (!bookingId || !paymentId || !extensionData) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "bookingId, paymentId, and extensionData are required"
      });
    }

    console.log("Confirming extension payment:", { bookingId, paymentId, extensionData });

    // First, get the existing booking to preserve original data
    const { data: existingBooking, error: fetchError } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchError || !existingBooking) {
      console.error("Error fetching existing booking:", fetchError);
      return res.status(404).json({
        error: "Booking not found",
        message: "The booking to extend was not found"
      });
    }

    // Check if payment record already exists (to prevent duplicate key error)
    const { data: existingPayment, error: paymentCheckError } = await supabase
      .from("Payment")
      .select("id")
      .eq("id", paymentId)
      .single();

    if (existingPayment && !paymentCheckError) {
      console.log("Payment record already exists for this payment ID:", paymentId);
      
      // Check if booking already has this extension
      const hasExtension = existingBooking.extensionamounts && existingBooking.extensionamounts.length > 0;
      
      if (hasExtension) {
        return res.json({
          success: true,
          message: "Extension already confirmed",
          booking: existingBooking,
          originalEndTime: existingBooking.endAt,
          alreadyConfirmed: true
        });
      }
    }

    console.log("Existing booking data:", existingBooking);

    // Get existing extension amounts array or create new one
    let extensionAmounts = existingBooking.extensionamounts || []
    const extensionCost = parseFloat(extensionData.extensionCost) || 0
    
    // Add new extension amount to array
    extensionAmounts.push(extensionCost)
    
    console.log("Extension amounts array:", extensionAmounts)

    // Get payment method from extensionData (user's selection) instead of payment record
    // Payment record is created BEFORE HitPay confirms, so it has wrong method
    let actualPaymentMethod = extensionData.paymentMethod || 'paynow_online';
    
    // If extension will be fully covered by credits, set method to "Credits"
    const creditAmountApplied = parseFloat(extensionData.creditAmount) || 0;
    const extensionBaseCost = parseFloat(extensionData.extensionCost) || 0;
    const willBeFullyCovered = creditAmountApplied > 0 && creditAmountApplied >= extensionBaseCost;
    if (willBeFullyCovered) {
      actualPaymentMethod = 'Credits';
      console.log('💳 Extension fully covered by credits, payment method set to "Credits"');
    } else {
      console.log('💳 Using payment method from frontend:', actualPaymentMethod);
    }

    // First, create a payment record for the extension if it doesn't exist
    const paymentData = {
      id: paymentId,
      bookingRef: existingBooking.bookingRef,
      startAt: existingBooking.startAt,
      endAt: extensionData.newEndAt,
      cost: parseFloat(extensionData.extensionCost) || 0,
      totalAmount: parseFloat(extensionData.extensionCost) || 0,
      paymentMethod: actualPaymentMethod, // Use actual payment method instead of "EXTENSION"
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log("Creating payment record:", paymentData);

    // Only create payment record if it doesn't already exist
    let paymentRecord;
    if (!existingPayment) {
      const { data: newPaymentRecord, error: paymentError } = await supabase
        .from("Payment")
        .insert([paymentData])
        .select()
        .single();

      if (paymentError) {
        console.error("Error creating payment record:", paymentError);
        return res.status(500).json({
          error: "Database error",
          message: "Failed to create payment record for extension",
          details: paymentError.message
        });
      }
      paymentRecord = newPaymentRecord;
      console.log("Payment record created:", paymentRecord);
    } else {
      // Use existing payment record
      const { data: existingPaymentData } = await supabase
        .from("Payment")
        .select("*")
        .eq("id", paymentId)
        .single();
      paymentRecord = existingPaymentData;
      console.log("Using existing payment record:", paymentRecord);
    }

    // Calculate total actual cost (original + all extensions)
    // The original cost should be totalAmount (which is the actual paid amount before extensions)
    const existingExtensions = (existingBooking.extensionamounts || []).reduce((sum, amount) => sum + amount, 0);
    const originalCost = parseFloat(existingBooking.totalAmount) || 0;
    
    const totalExtensionCost = extensionAmounts.reduce((sum, amount) => sum + amount, 0)
    const totalActualCost = originalCost + totalExtensionCost
    
    // Don't update totalCost with extension - keep it as the original booking cost
    // totalCost should remain the original booking cost, not include extensions
    
    console.log("Cost calculation:", {
      originalCost,
      existingExtensions,
      extensionAmounts,
      totalExtensionCost,
      totalActualCost,
      existingTotalCost: existingBooking.totalCost,
      existingTotalActualCost: existingBooking.totalactualcost
    })

    // Update the booking with extension details and payment confirmation
    // IMPORTANT: If original booking was unpaid, mark it as paid when extending
    const updateData = {
      endAt: extensionData.newEndAt,
      seatNumbers: extensionData.seatNumbers,
      // Don't update totalCost - it should remain the original booking cost
      // Don't update totalAmount - it should remain the original booking amount
      // If original booking was unpaid, mark as paid when extending
      confirmedPayment: existingBooking.confirmedPayment || true, // If false, make it true
      paymentId: paymentId, // Update paymentId to extension payment ID
      updatedAt: new Date().toISOString()
    };

    // Add extension tracking columns (using correct column names from schema)
    updateData.extensionamounts = extensionAmounts
    updateData.totalactualcost = totalActualCost

    // Use credits as discount for extension payment (OPTIONAL)
    console.log("💳 Checking for credit discount on extension...");
    const creditAmount = parseFloat(extensionData.creditAmount) || 0;
    
    if (creditAmount > 0 && existingBooking.userId) {
      try {
        console.log(`💳 Applying ${creditAmount} credits as discount...`);
        
        // Use credits for the extension as a discount
        const creditResult = await useCreditsForBooking(
          existingBooking.userId,
          bookingId,
          creditAmount
        );
        
        console.log("✅ Credits used as discount for extension:", creditResult);
        
      } catch (creditError) {
        console.error("❌ Error applying credits as discount:", creditError);
        // Don't fail the entire request - just log the error
        // The extension can still proceed without credits
        console.log("⚠️ Extension will proceed without credit discount");
      }
    } else {
      console.log("ℹ️ No credits applied to this extension");
    }

    console.log("Updating booking with extension data:", updateData);

    const { data: updatedBooking, error: updateError } = await supabase
      .from("Booking")
      .update(updateData)
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating booking for extension:", updateError);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to update booking with extension details",
        details: updateError.message
      });
    }

    // Log extension activity
    try {
      // Get user details for activity log
      const { data: userData } = await supabase
        .from('User')
        .select('id, email, firstName, lastName')
        .eq('id', existingBooking.userId)
        .single()

      const userName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : null
      
      // IMPORTANT: Capture original times BEFORE any updates
      // Use existingBooking times as the ORIGINAL times (before this extension)
      const originalStartAt = existingBooking.startAt
      const originalEndAt = existingBooking.endAt
      const newStartAt = existingBooking.startAt // Start time unchanged for extend
      const newEndAt = extensionData.newEndAt
      const extensionHours = extensionData.hours || extensionData.extensionHours || 0
      
      // Format dates for description - ensure we use the correct original times
      const oldStart = new Date(originalStartAt).toLocaleString('en-SG', { 
        timeZone: 'Asia/Singapore',
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      })
      const oldEnd = new Date(originalEndAt).toLocaleString('en-SG', { 
        timeZone: 'Asia/Singapore',
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      })
      const newEnd = new Date(newEndAt).toLocaleString('en-SG', { 
        timeZone: 'Asia/Singapore',
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      })
      
      await logBookingActivity({
        bookingId: updatedBooking.id,
        bookingRef: updatedBooking.bookingRef,
        activityType: ACTIVITY_TYPES.EXTEND_APPROVED,
        activityTitle: 'Booking Extended',
        activityDescription: `Extended by ${extensionHours} hour(s). Old: ${oldStart} - ${oldEnd} → New: ${oldStart} - ${newEnd}`,
        userId: existingBooking.userId,
        userName: userName,
        userEmail: userData?.email || existingBooking.bookedForEmails?.[0],
        amount: extensionData.extensionCost || extensionData.cost || 0,
        oldValue: `${originalStartAt} - ${originalEndAt}`,
        newValue: `${newStartAt} - ${newEndAt}`,
        metadata: {
          originalStartAt: originalStartAt,
          originalEndAt: originalEndAt,
          newStartAt: newStartAt, // Start time unchanged for extend
          newEndAt: newEndAt,
          extensionHours: extensionHours,
          extensionCost: extensionData.extensionCost || extensionData.cost || 0,
          creditAmount: creditAmount
        }
      });
      console.log('✅ Extension activity logged successfully')
      console.log('📝 Activity times - Old:', { start: originalStartAt, end: originalEndAt }, 'New:', { start: newStartAt, end: newEndAt });

      // Log credit usage if credits were used for extension
      if (creditAmount > 0) {
        await logBookingActivity({
          bookingId: updatedBooking.id,
          bookingRef: updatedBooking.bookingRef,
          activityType: ACTIVITY_TYPES.CREDIT_USED,
          activityTitle: 'Credits Applied to Extension',
          activityDescription: `Credits used for extension payment`,
          userId: existingBooking.userId,
          userName: userName,
          userEmail: userData?.email || existingBooking.bookedForEmails?.[0],
          amount: creditAmount
        });
        console.log('✅ Credit usage activity logged successfully');
      }
    } catch (logError) {
      console.error('❌ Error logging extension activity:', logError);
      // Don't fail extension if logging fails
    }

    // Ensure timestamps are in proper UTC format with 'Z' suffix BEFORE sending email
    if (updatedBooking.startAt && !updatedBooking.startAt.endsWith('Z')) {
      updatedBooking.startAt = updatedBooking.startAt + 'Z';
    }
    if (updatedBooking.endAt && !updatedBooking.endAt.endsWith('Z')) {
      updatedBooking.endAt = updatedBooking.endAt + 'Z';
    }
    if (updatedBooking.bookedAt && !updatedBooking.bookedAt.endsWith('Z')) {
      updatedBooking.bookedAt = updatedBooking.bookedAt + 'Z';
    }
    if (updatedBooking.createdAt && !updatedBooking.createdAt.endsWith('Z')) {
      updatedBooking.createdAt = updatedBooking.createdAt + 'Z';
    }
    if (updatedBooking.updatedAt && !updatedBooking.updatedAt.endsWith('Z')) {
      updatedBooking.updatedAt = updatedBooking.updatedAt + 'Z';
    }

    // Also format originalEndTime (use from extensionData.originalEndAt if available, otherwise existingBooking.endAt)
    let formattedOriginalEndTime = extensionData.originalEndAt || existingBooking.endAt;
    if (formattedOriginalEndTime && !formattedOriginalEndTime.endsWith('Z')) {
      formattedOriginalEndTime = formattedOriginalEndTime + 'Z';
    }

    // Get user data for email
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("*")
      .eq("id", updatedBooking.userId)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
    }

    // Calculate payment fee for invoice
    const baseAmount = parseFloat(extensionData.extensionCost) || 0;
    const extensionCreditAmount = creditAmount || 0;
    const subtotalAfterCredits = Math.max(0, baseAmount - extensionCreditAmount);
    
    // Calculate fee based on payment method (DYNAMIC)
    // NO FEE if fully covered by credits (subtotal = 0)
    const isCreditCard = actualPaymentMethod === 'card' || actualPaymentMethod === 'credit_card' || actualPaymentMethod === 'creditcard' || actualPaymentMethod.toLowerCase().includes('card');
    const { getPaymentSettings } = require('../utils/paymentFeeHelper');
    const feeSettings = await getPaymentSettings();
    const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
    const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;
    const paymentFee = subtotalAfterCredits === 0 ? 0 : (isCreditCard ? subtotalAfterCredits * (cardFeePercentage / 100) : (subtotalAfterCredits < 10 ? paynowFeeAmount : 0));
    const finalAmountPaid = subtotalAfterCredits + paymentFee;
    
    console.log('💰 Extension payment breakdown:', {
      baseAmount,
      creditAmount: extensionCreditAmount,
      subtotalAfterCredits,
      paymentMethod: actualPaymentMethod,
      isCreditCard,
      paymentFee,
      finalAmountPaid
    });

    // Send extension confirmation email with invoice PDF (NOW with properly formatted timestamps)
    try {
      if (userData) {
        await sendExtensionConfirmation(userData, updatedBooking, {
          extensionHours: extensionData.extensionHours,
          extensionCost: extensionData.extensionCost,
          originalEndAt: formattedOriginalEndTime,
          newEndAt: updatedBooking.endAt, // Use formatted endAt
          creditAmount: extensionCreditAmount, // Use the calculated credit amount
          paymentMethod: actualPaymentMethod || updatedBooking.paymentMethod || 'paynow_online',
          paymentFee: paymentFee,
          finalAmount: finalAmountPaid
        });
        console.log("✅ Extension confirmation email sent successfully");
      }
    } catch (emailError) {
      console.error("❌ Error sending extension confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: "Extension payment confirmed successfully",
      booking: updatedBooking,
      payment: paymentRecord,
      originalEndTime: formattedOriginalEndTime // Send original end time before extension
    });

  } catch (error) {
    console.error("Error confirming extension payment:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to confirm extension payment"
    });
  }
};