const { sendExtensionConfirmation } = require("../utils/email");
const { useCreditsForBooking } = require("../utils/creditHelper");
const { logBookingActivity, ACTIVITY_TYPES } = require("../utils/bookingActivityLogger");
const supabase = require("../config/database");

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

