const supabase = require('../config/database');
const { sendRefundConfirmation } = require('../utils/email');

// Request refund for a booking
const requestRefund = async (req, res) => {
  try {
    // AUTH-001 Fix: Use authenticated user's ID instead of req.body to prevent IDOR
    const userid = req.user.id;
    const { bookingid, reason } = req.body;

    // DATA-001 Fix: Sanitize logs to mask sensitive IDs
    const maskedUserId = userid ? `${userid.substring(0, 8)}...` : 'N/A';
    const maskedBookingId = bookingid ? `${bookingid.substring(0, 8)}...` : 'N/A';
    console.log('🔄 Refund request:', { bookingid: maskedBookingId, userid: maskedUserId });

    // Validate required fields
    if (!bookingid) {
      console.error('❌ Missing bookingid');
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    if (!reason || !reason.trim()) {
      console.error('❌ Missing or empty reason');
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    // Fetch the actual booking data from database
    console.log('🔍 Fetching booking data from database...');
    const { data: booking, error: bookingError } = await supabase
      .from('Booking')
      .select('id, userId, totalAmount, confirmedPayment, refundstatus, paymentId, bookingRef')
      .eq('id', bookingid)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Error fetching booking:', bookingError);
      return res.status(404).json({ error: 'Booking not found' });
    }

    console.log('📊 Retrieved booking data:', booking);

    // Fetch the actual paid amount from Payment table (includes ALL payments: original + reschedule)
    console.log('🔍 Fetching ALL payments for booking to calculate total refund amount...');
    let actualPaidAmount = 0;
    let allPayments = [];
    
    console.log('🔍 Finding all payments for booking:', {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      paymentId: booking.paymentId
    });

    // Find ALL payments related to this booking (original + reschedule)
    // Try multiple query patterns to find all related payments
    let paymentQuery = supabase
      .from('Payment')
      .select('id, totalAmount, cost, paymentMethod, bookingRef, createdAt');
    
    // Build the OR condition safely
    // Sanitize booking references to prevent SQL injection
    const { sanitizeBookingRef, sanitizeUUID, buildSafeOrQuery } = require("../utils/inputSanitizer");
    
    // FIXED: Use buildSafeOrQuery instead of string interpolation
    const orConditions = [];
    if (booking.bookingRef) {
      const sanitizedRef = sanitizeBookingRef(booking.bookingRef);
      if (sanitizedRef) {
        orConditions.push({ field: 'bookingRef', operator: 'eq', value: sanitizedRef });
      }
    }
    
    // Sanitize booking ID (UUID)
    const sanitizedBookingId = sanitizeUUID(booking.id);
    if (sanitizedBookingId) {
      orConditions.push({ field: 'bookingRef', operator: 'eq', value: `RESCHEDULE_${sanitizedBookingId}` });
      orConditions.push({ field: 'bookingRef', operator: 'eq', value: sanitizedBookingId });
    }
    
    const safeOrQuery = buildSafeOrQuery(orConditions);
    if (safeOrQuery) {
      paymentQuery = paymentQuery.or(safeOrQuery);
    }
    
    paymentQuery = paymentQuery.order('createdAt', { ascending: true }); // Order by creation time to see original first
    
    const { data: payments, error: paymentsError } = await paymentQuery;

    console.log('🔍 Refund query used:', safeOrQuery || 'none');

    if (payments && !paymentsError) {
      allPayments = payments;
      console.log('📊 Found payments for booking:', payments.map(p => ({
        id: p.id,
        bookingRef: p.bookingRef,
        amount: p.totalAmount || p.cost,
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt
      })));

      // If we only found one payment, try a broader search
      if (payments.length === 1) {
        console.log('⚠️ Only found 1 payment, trying broader search...');
        const { data: broaderPayments, error: broaderError } = await supabase
          .from('Payment')
          .select('id, totalAmount, cost, paymentMethod, bookingRef, createdAt')
          .ilike('bookingRef', `%${booking.bookingRef}%`)
          .order('createdAt', { ascending: true });

        if (broaderPayments && broaderPayments.length > 1) {
          console.log('📊 Broader search found more payments:', broaderPayments);
          allPayments = broaderPayments;
        }
      }

      // Sum up all payments
      actualPaidAmount = allPayments.reduce((sum, payment) => {
        const amount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
        console.log(`💰 Adding payment ${payment.id} (${payment.bookingRef}): $${amount}`);
        return sum + amount;
      }, 0);

      console.log('💰 Total amount paid across all payments:', actualPaidAmount);
    } else {
      console.log('⚠️ No payments found, trying fallback methods...');
      
      // Fallback: try to get payment by paymentId (single payment)
      if (booking.paymentId) {
        const { data: payment, error: paymentError } = await supabase
          .from('Payment')
          .select('totalAmount, cost, paymentMethod')
          .eq('id', booking.paymentId)
          .single();

        if (payment && !paymentError) {
          actualPaidAmount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
          allPayments = [payment];
          console.log('📊 Fallback: Found single payment by paymentId:', actualPaidAmount);
        }
      }
      
      // Final fallback: use booking totalAmount
      if (actualPaidAmount === 0) {
        actualPaidAmount = parseFloat(booking.totalAmount) || 0;
        console.log('📊 Final fallback: Using booking totalAmount:', actualPaidAmount);
      }
    }

    console.log('💰 Final total amount to refund:', actualPaidAmount);

    // Find credit usage for this booking to calculate actual cash paid
    console.log('🔍 Finding credit usage for this booking...');
    const { data: creditUsages, error: creditUsageError } = await supabase
      .from('creditusage')
      .select('id, amountused, creditid, usercredits(amount, status)')
      .eq('bookingid', bookingid);

    let totalCreditsUsed = 0;
    if (creditUsages && !creditUsageError) {
      totalCreditsUsed = creditUsages.reduce((sum, usage) => {
        const amount = parseFloat(usage.amountused) || 0;
        console.log(`💳 Credit usage found: $${amount}`);
        return sum + amount;
      }, 0);
      console.log('💳 Total credits used for this booking:', totalCreditsUsed);
    } else {
      console.log('💳 No credit usage found for this booking');
    }

    // Calculate actual cash paid (total - credits used)
    const actualCashPaid = actualPaidAmount - totalCreditsUsed;
    console.log('💰 Actual cash paid calculation:', {
      totalPaid: actualPaidAmount,
      creditsUsed: totalCreditsUsed,
      actualCashPaid: actualCashPaid
    });

    // Calculate fee deductions for each payment method (only on cash payments)
    let finalRefundAmount = 0;
    
    // Only calculate fees on the actual cash paid (not credits)
    if (actualCashPaid > 0) {
      console.log('💳 Processing fee deductions for cash payments only...');
      
      // For simplicity, apply fees proportionally to the cash amount
      // This assumes the latest payment method applies to the cash portion
      const latestPayment = allPayments && allPayments.length > 0 ? allPayments[allPayments.length - 1] : null;
      const paymentMethod = latestPayment ? latestPayment.paymentMethod : 'Unknown';
      
      console.log('💳 Using payment method for fee calculation:', paymentMethod);
      
      const isCardPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('card') || 
         paymentMethod.toLowerCase().includes('credit'));
      
      const isPayNowPayment = paymentMethod &&
        (paymentMethod.toLowerCase().includes('paynow') ||
         paymentMethod.toLowerCase().includes('pay_now'));
      
      if (isCardPayment) {
        // Calculate original amount before dynamic % card fee
        const { getPaymentSettings } = require('../utils/paymentFeeHelper');
        const feeSettings = await getPaymentSettings();
        const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
        const multiplier = 1 + (cardFeePercentage / 100);
        const originalAmount = actualCashPaid / multiplier;
        finalRefundAmount = originalAmount;
        
        console.log(`💳 Card payment - deducting ${cardFeePercentage}% fee from cash amount:`, {
          cashPaid: actualCashPaid,
          originalAmount: originalAmount,
          cardFee: actualCashPaid - originalAmount,
          refundAmount: finalRefundAmount
        });
      } else if (isPayNowPayment && actualCashPaid < 10) {
        // Calculate original amount before $0.20 PayNow fee
        const originalAmount = actualCashPaid - 0.20;
        finalRefundAmount = Math.max(0, originalAmount);
        
        console.log('💳 PayNow payment - deducting $0.20 transaction fee from cash amount:', {
          cashPaid: actualCashPaid,
          originalAmount: originalAmount,
          transactionFee: 0.20,
          refundAmount: finalRefundAmount
        });
      } else {
        finalRefundAmount = actualCashPaid;
        console.log('💳 No fee deduction needed for cash amount:', actualCashPaid);
      }
    } else {
      finalRefundAmount = 0;
      console.log('💳 No cash paid, only credits used - no refund needed');
    }

    console.log('💰 Final refund amount after fee deduction:', finalRefundAmount);
    
    // Additional logging for debugging
    console.log('📋 Refund calculation summary:', {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      totalPaymentsFound: allPayments.length,
      totalPaidAmount: actualPaidAmount,
      finalRefundAmount: finalRefundAmount,
      feesDeducted: actualPaidAmount - finalRefundAmount,
      paymentBreakdown: allPayments.map(p => ({
        id: p.id,
        bookingRef: p.bookingRef,
        amount: parseFloat(p.totalAmount) || parseFloat(p.cost) || 0,
        method: p.paymentMethod
      }))
    });

    // Verify the booking belongs to the requesting user
    if (booking.userId !== userid) {
      // DATA-001 Fix: Sanitize logs to mask sensitive IDs
      const maskedBookingUserId = booking.userId ? `${booking.userId.substring(0, 8)}...` : 'N/A';
      const maskedRequestingUserId = userid ? `${userid.substring(0, 8)}...` : 'N/A';
      console.error('❌ Booking does not belong to user:', { bookingUserId: maskedBookingUserId, requestingUserId: maskedRequestingUserId });
      return res.status(403).json({ error: 'You can only request refunds for your own bookings' });
    }

 

    // Check if booking is confirmed (has payment)
    if (!booking.confirmedPayment) {
      return res.status(400).json({ error: 'Cannot refund unconfirmed booking' });
    }

    
    const { data: updateData, error: updateBookingError } = await supabase
      .from('Booking')
      .update({
        refundstatus: 'REQUESTED',
        refundrequestedat: new Date().toISOString(),
        refundreason: reason
      })
      .eq('id', bookingid)
      .select();

    console.log('📊 Update result:', { updateData, updateBookingError });

    if (updateBookingError) {
      console.error('❌ Error updating booking status:', updateBookingError);
      return res.status(500).json({ error: 'Failed to update booking status' });
    }
    console.log('✅ Booking refund status updated successfully');

    // Create refund transaction record
    console.log('🔄 Creating refund transaction...');
    const { data: refundTransaction, error: transactionError } = await supabase
      .from('refundtransactions')
      .insert({
        userid: userid,
        bookingid: bookingid,
        refundamount: finalRefundAmount,
        creditamount: finalRefundAmount,
        refundreason: reason,
        refundstatus: 'REQUESTED'
      })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ Error creating refund transaction:', transactionError);
      return res.status(500).json({ error: 'Failed to create refund transaction' });
    }

    console.log('✅ Refund transaction created successfully');

    // Auto-approve the refund immediately
    console.log('🔄 Auto-approving refund...');
    
    // Calculate expiry date (30 days from now)
    const expiresat = new Date();
    expiresat.setDate(expiresat.getDate() + 30);

    // POLICY: No refund for credits, discounts, or promo codes
    if (totalCreditsUsed > 0) {
      console.log('🚫 POLICY: Credits used are non-refundable:', {
        creditsUsed: totalCreditsUsed,
        policy: 'No refund for credits, discounts, or promo codes'
      });
    }

    // Create user credit for cash refund (if any)
    let credit = null;
    if (finalRefundAmount > 0) {
      console.log('🔄 Creating user credit for cash refund:', {
        userid: userid,
        amount: finalRefundAmount,
        refundedfrombookingid: bookingid,
        expiresat: expiresat.toISOString()
      });
      
      const { data: creditData, error: creditError } = await supabase
        .from('usercredits')
        .insert({
          userid: userid,
          amount: finalRefundAmount,
          refundedfrombookingid: bookingid,
          expiresat: expiresat.toISOString()
        })
        .select()
        .single();

      if (creditError) {
        console.error('❌ Error creating user credit:', creditError);
        return res.status(500).json({ error: 'Failed to create user credit' });
      }
      
      credit = creditData;
    }

    // Update refund transaction status to APPROVED
    console.log('🔄 Updating refund transaction status to APPROVED...');
    const { error: updateRefundError } = await supabase
      .from('refundtransactions')
      .update({
        refundstatus: 'APPROVED'
      })
      .eq('id', refundTransaction.id);

    if (updateRefundError) {
      console.error('❌ Error updating refund transaction:', updateRefundError);
      return res.status(500).json({ error: 'Failed to update refund transaction' });
    }

    // Update booking status to APPROVED
    console.log('🔄 Updating booking refund status to APPROVED...');
    const { error: updateBookingApprovalError } = await supabase
      .from('Booking')
      .update({
        refundstatus: 'APPROVED',
        refundapprovedat: new Date().toISOString(),
        refundapprovedby: null // Auto-approved
      })
      .eq('id', bookingid);

    if (updateBookingApprovalError) {
      console.error('❌ Error updating booking status:', updateBookingApprovalError);
      return res.status(500).json({ error: 'Failed to update booking status' });
    }

    // Mark booking as refunded and release seats for others
    console.log('🔄 Marking booking as refunded and releasing seats...');
    const { error: refundBookingError } = await supabase
      .from('Booking')
      .update({
        seatNumbers: [], // Clear seat numbers to release seats for other users
        // Keep payment information for audit trail
      })
      .eq('id', bookingid);

    if (refundBookingError) {
      console.error('❌ Error marking booking as refunded:', refundBookingError);
      // Don't return error here as refund is already processed
      console.log('⚠️ Warning: Refund processed but booking update failed');
    } else {
      console.log('✅ Booking marked as refunded, seats released for other users');
    }

    console.log('✅ Refund auto-approved successfully');
    
    // Prepare response with refund details and policy information
    const response = {
      message: 'Refund approved successfully',
      bookingid,
      refundDetails: {
        totalPaid: actualPaidAmount,
        creditsUsed: totalCreditsUsed,
        cashPaid: actualCashPaid,
        cashRefunded: finalRefundAmount,
        creditsRefunded: 0, // POLICY: Credits are non-refundable
        policy: 'Credits, discounts, and promo codes are non-refundable'
      },
      expiresat: expiresat.toISOString()
    };

    // Add credit ID if cash refund exists
    if (finalRefundAmount > 0 && credit) {
      response.cashCreditId = credit.id;
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Error in requestRefund:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's refund requests
const getUserRefundRequests = async (req, res) => {
  try {
    const userid = req.query.userid || '00000000-0000-0000-0000-000000000000';

    const { data: refunds, error } = await supabase
      .from('refundtransactions')
      .select(`
        *,
        "Booking" (
          bookingRef,
          startAt,
          endAt,
          location,
          totalAmount
        )
      `)
      .eq('userid', userid)
      .order('requestedat', { ascending: false });

    if (error) {
      console.error('❌ Error fetching refund requests:', error);
      return res.status(500).json({ error: 'Failed to fetch refund requests' });
    }

    res.json(refunds);
  } catch (error) {
    console.error('❌ Error in getUserRefundRequests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's credits
const getUserCredits = async (req, res) => {
  try {
    const userid = req.query.userid || '00000000-0000-0000-0000-000000000000';

    const { data: credits, error } = await supabase
      .from('usercredits')
      .select(`
        *,
        "Booking" (
          bookingRef,
          startAt,
          endAt,
          location,
          totalAmount
        )
      `)
      .eq('userid', userid)
      .eq('status', 'ACTIVE')
      .order('refundedat', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user credits:', error);
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    const totalCredit = credits.reduce((sum, credit) => sum + parseFloat(credit.amount), 0);

    res.json({
      credits,
      totalCredit,
      count: credits.length
    });
  } catch (error) {
    console.error('❌ Error in getUserCredits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's credit usage
const getUserCreditUsage = async (req, res) => {
  try {
    const userid = req.query.userid || '00000000-0000-0000-0000-000000000000';

    const { data: usage, error } = await supabase
      .from('creditusage')
      .select(`
        *,
        "Booking" (
          bookingRef,
          startAt,
          endAt,
          location,
          totalAmount
        )
      `)
      .eq('userid', userid)
      .order('usedat', { ascending: false });

    if (error) {
      console.error('❌ Error fetching credit usage:', error);
      return res.status(500).json({ error: 'Failed to fetch credit usage' });
    }

    res.json(usage);
  } catch (error) {
    console.error('❌ Error in getUserCreditUsage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  requestRefund,
  getUserRefundRequests,
  getUserCredits,
  getUserCreditUsage
};