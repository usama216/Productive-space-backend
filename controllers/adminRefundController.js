const supabase = require('../config/database');
const { sendRefundConfirmation } = require('../utils/email');

// Get all refund requests for admin
const getAllRefundRequests = async (req, res) => {
  try {
    const { data: refunds, error } = await supabase
      .from('refundtransactions')
      .select(`
        *,
        User!refundtransactions_userid_fkey (
          email,
          firstName,
          lastName
        ),
        "Booking" (
          bookingRef,
          startAt,
          endAt,
          location,
          totalAmount,
          seatNumbers,
          pax
        )
      `)
      .order('requestedat', { ascending: false });

    if (error) {
      console.error('❌ Error fetching refund requests:', error);
      return res.status(500).json({ error: 'Failed to fetch refund requests' });
    }

    res.json(refunds);
  } catch (error) {
    console.error('❌ Error in getAllRefundRequests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve refund request
  const approveRefund = async (req, res) => {
    try {
      const { refundId } = req.params;

      console.log('✅ Approving refund:', { refundId });

    // Get refund transaction details
    console.log('🔍 Fetching refund transaction with ID:', refundId);
    const { data: refund, error: refundError } = await supabase
      .from('refundtransactions')
      .select(`
        *,
        User!refundtransactions_userid_fkey (
          email,
          firstName,
          lastName
        ),
        "Booking"!refundtransactions_bookingid_fkey (
          bookingRef,
          startAt,
          endAt,
          location,
          totalAmount
        )
      `)
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return res.status(404).json({ error: 'Refund request not found' });
    }

    if (refund.refundstatus !== 'REQUESTED') {
      return res.status(400).json({ error: 'Refund request already processed' });
    }

    // Calculate expiry date (30 days from now)
    const expiresat = new Date();
    expiresat.setDate(expiresat.getDate() + 30);

    // Create user credit
    console.log('🔄 Creating user credit:', {
      userid: refund.userid,
      amount: refund.creditamount,
      refundedfrombookingid: refund.bookingid,
      expiresat: expiresat.toISOString()
    });
    
    const { data: credit, error: creditError } = await supabase
      .from('usercredits')
      .insert({
        userid: refund.userid,
        amount: refund.creditamount,
        refundedfrombookingid: refund.bookingid,
        expiresat: expiresat.toISOString()
      })
      .select()
      .single();

    console.log('📊 Credit creation result:', { credit, creditError });

    if (creditError) {
      console.error('❌ Error creating user credit:', creditError);
      return res.status(500).json({ error: 'Failed to create user credit' });
    }

    // Update refund transaction status
    console.log('🔄 Updating refund transaction status:', {
      refundId,
      refundstatus: 'APPROVED'
    });
    
    const { error: updateRefundError } = await supabase
      .from('refundtransactions')
      .update({
        refundstatus: 'APPROVED'
      })
      .eq('id', refundId);

    console.log('📊 Refund update result:', { updateRefundError });

    if (updateRefundError) {
      console.error('❌ Error updating refund transaction:', updateRefundError);
      return res.status(500).json({ error: 'Failed to update refund transaction' });
    }

          // Update booking status
          console.log('🔄 Updating booking refund status to APPROVED...');
          const { error: updateBookingError } = await supabase
            .from('Booking')
            .update({
              refundstatus: 'APPROVED',
              refundapprovedat: new Date().toISOString(),
              refundapprovedby: null // No admin ID needed for single admin setup
            })
            .eq('id', refund.bookingid);

    if (updateBookingError) {
      console.error('❌ Error updating booking status:', updateBookingError);
      return res.status(500).json({ error: 'Failed to update booking status' });
    }
    console.log('✅ Booking refund status updated to APPROVED');

    // Mark booking as refunded and release seats for others
    console.log('🔄 Marking booking as refunded and releasing seats...');
    const { error: refundBookingError } = await supabase
      .from('Booking')
      .update({
        seatNumbers: [], // Clear seat numbers to release seats for other users
        // Keep payment information for audit trail:
        // - confirmedPayment: true (maintains payment record)
        // - paymentId: unchanged (maintains payment reference)
        // - refundstatus: 'APPROVED' (already updated above)
        // This booking is now just a record - seats are released for others
        // Payment information is preserved for audit purposes
      })
      .eq('id', refund.bookingid);

    if (refundBookingError) {
      console.error('❌ Error marking booking as refunded:', refundBookingError);
      // Don't return error here as refund is already processed
      console.log('⚠️ Warning: Refund processed but booking update failed');
    } else {
      console.log('✅ Booking marked as refunded, seats released for other users, payment records preserved');
    }

    // Send refund confirmation email
    try {
      await sendRefundConfirmation({
        user: refund.User,
        booking: refund.Booking,
        creditamount: refund.creditamount,
        expiresat: expiresat.toISOString()
      });
      console.log('✅ Refund confirmation email sent');
    } catch (emailError) {
      console.error('❌ Error sending refund email:', emailError);
      // Don't fail the request if email fails
    }

    console.log('✅ Refund approved successfully');
    res.json({ 
      message: 'Refund approved successfully', 
      creditid: credit.id,
      creditamount: refund.creditamount,
      expiresat: expiresat.toISOString()
    });
  } catch (error) {
    console.error('❌ Error in approveRefund:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject refund request
  const rejectRefund = async (req, res) => {
    try {
      const { refundId } = req.params;

      console.log('❌ Rejecting refund:', { refundId });

    // Get refund transaction details
    const { data: refund, error: refundError } = await supabase
      .from('refundtransactions')
      .select('*')
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return res.status(404).json({ error: 'Refund request not found' });
    }

    if (refund.refundstatus !== 'REQUESTED') {
      return res.status(400).json({ error: 'Refund request already processed' });
    }

    // Update refund transaction status
    console.log('🔄 Updating refund transaction status to REJECTED:', { refundId });
    
    const { error: updateRefundError } = await supabase
      .from('refundtransactions')
      .update({
        refundstatus: 'REJECTED',
        refundreason: 'Rejected by admin'
      })
      .eq('id', refundId);

    if (updateRefundError) {
      console.error('❌ Error updating refund transaction:', updateRefundError);
      return res.status(500).json({ error: 'Failed to update refund transaction' });
    }

          // Update booking status
          console.log('🔄 Updating booking refund status to REJECTED...');
          const { error: updateBookingError } = await supabase
            .from('Booking')
            .update({
              refundstatus: 'REJECTED',
              refundapprovedat: new Date().toISOString(),
              refundapprovedby: null // No admin ID needed for single admin setup
            })
            .eq('id', refund.bookingid);

    if (updateBookingError) {
      console.error('❌ Error updating booking status:', updateBookingError);
      return res.status(500).json({ error: 'Failed to update booking status' });
    }
    console.log('✅ Booking refund status updated to REJECTED');

    console.log('✅ Refund rejected successfully');
    res.json({ message: 'Refund rejected successfully' });
  } catch (error) {
    console.error('❌ Error in rejectRefund:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all user credits for admin
const getAllUserCredits = async (req, res) => {
  try {
    const { data: credits, error } = await supabase
      .from('usercredits')
      .select(`
        *,
        User!usercredits_userid_fkey (
          email,
          firstName,
          lastName
        ),
        "Booking" (
          bookingRef,
          startAt,
          endAt,
          location
        )
      `)
      .order('createdat', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user credits:', error);
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    res.json(credits);
  } catch (error) {
    console.error('❌ Error in getAllUserCredits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get refund statistics
const getRefundStats = async (req, res) => {
  try {
    const { data: stats, error } = await supabase
      .from('refundtransactions')
      .select('refundstatus, refundamount')
      .eq('refundstatus', 'APPROVED');

    if (error) {
      console.error('❌ Error fetching refund stats:', error);
      return res.status(500).json({ error: 'Failed to fetch refund stats' });
    }

    const totalRefunded = stats.reduce((sum, stat) => sum + parseFloat(stat.refundamount), 0);
    const totalTransactions = stats.length;

    res.json({
      totalRefunded,
      totalTransactions,
      averageRefund: totalTransactions > 0 ? totalRefunded / totalTransactions : 0
    });
  } catch (error) {
    console.error('❌ Error in getRefundStats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllRefundRequests,
  approveRefund,
  rejectRefund,
  getAllUserCredits,
  getRefundStats
};
