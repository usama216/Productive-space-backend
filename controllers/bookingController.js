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
