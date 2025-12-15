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
              refundapprovedby: 'admin' // Mark as approved by admin
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
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, Math.min(100, parseInt(limit)));
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    // If search is provided, first find user IDs by email
    let userIdsToFilter = null;
    let searchedUsers = null;
    if (search && typeof search === 'string' && search.trim() !== '') {
      const { data: users, error: userError } = await supabase
        .from('User')
        .select('id, email, firstName, lastName')
        .ilike('email', `%${search.trim()}%`);
      
      if (userError) {
        console.error('❌ Error searching users:', userError);
      } else if (users && users.length > 0) {
        userIdsToFilter = users.map(u => u.id);
        searchedUsers = users; // Store full user data for users with no credits
      } else {
        // No users found, return empty result
        return res.json({
          items: [],
          pagination: {
            page: pageNum,
            limit: pageSize,
            total: 0,
            totalPages: 0
          }
        });
      }
    }

    let baseQuery = supabase
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
      `, { count: 'exact' })
      .order('createdat', { ascending: false });

    if (userIdsToFilter && userIdsToFilter.length > 0) {
      baseQuery = baseQuery.in('userid', userIdsToFilter);
    }

    const { data: credits, error, count } = await baseQuery.range(from, to);

    if (error) {
      console.error('❌ Error fetching user credits:', error);
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    // Build a list of credit IDs and user IDs
    const creditIds = credits.map(c => c.id);
    const uniqueUserIds = [...new Set(credits.map(c => c.userid))];

    // If searching, also include users who have no credits (show them with 0 credits)
    if (searchedUsers && searchedUsers.length > 0) {
      const usersWithCredits = new Set(uniqueUserIds);
      const usersWithoutCredits = searchedUsers.filter(u => !usersWithCredits.has(u.id));
      
      // For users without credits, create virtual entries showing 0 credits
      usersWithoutCredits.forEach(user => {
        uniqueUserIds.push(user.id);
      });
    }

    // Fetch all usages for these credits in one go (only if there are credits)
    let usagesAll = [];
    if (creditIds.length > 0) {
      const { data: usages } = await supabase
        .from('creditusage')
        .select('creditid, userid, amountused')
        .in('creditid', creditIds);
      usagesAll = usages || [];
    }

    // Index usage by creditId
    const usageByCreditId = {};
    usagesAll.forEach(u => {
      const used = parseFloat(u.amountused || 0);
      usageByCreditId[u.creditid] = (usageByCreditId[u.creditid] || 0) + used;
    });

    // Build totals per user by fetching all their credits and usages (accurate even with pagination)
    const userTotalsMap = {};
    await Promise.all(uniqueUserIds.map(async (uid) => {
      const { data: userAllCredits } = await supabase
        .from('usercredits')
        .select('id, amount, status')
        .eq('userid', uid);
      const { data: userAllUsages } = await supabase
        .from('creditusage')
        .select('amountused')
        .eq('userid', uid);
      const remainingCredit = (userAllCredits || [])
        .filter(c => c.status === 'ACTIVE')
        .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      const usedCredit = (userAllUsages || [])
        .reduce((sum, u) => sum + parseFloat(u.amountused || 0), 0);
      const totalCredit = remainingCredit + usedCredit;
      userTotalsMap[uid] = { totalCredit, usedCredit, remainingCredit };
    }));

    // Enrich each credit with per-credit usage and user totals
    const enrichedCredits = credits.map(credit => ({
      ...credit,
      ...userTotalsMap[credit.userid],
      creditUsed: usageByCreditId[credit.id] || 0,
      creditRemaining: credit.status === 'ACTIVE' ? parseFloat(credit.amount || 0) : 0,
      creditOriginal: (usageByCreditId[credit.id] || 0) + (credit.status === 'ACTIVE' ? parseFloat(credit.amount || 0) : 0)
    }));

    // If searching and there are users without credits, add virtual entries for them
    if (searchedUsers && searchedUsers.length > 0) {
      const usersWithCredits = new Set(credits.map(c => c.userid));
      const usersWithoutCredits = searchedUsers.filter(u => !usersWithCredits.has(u.id));
      
      // Create a map of all users (with and without credits) for proper pagination
      const allUserIds = [...new Set([...credits.map(c => c.userid), ...usersWithoutCredits.map(u => u.id)])];
      
      // Get paginated user IDs
      const paginatedUserIds = allUserIds.slice(from, to + 1);
      
      // Add virtual credit entries for users with 0 credits that are in the current page
      usersWithoutCredits.forEach(user => {
        if (paginatedUserIds.includes(user.id)) {
          enrichedCredits.push({
            id: `virtual-${user.id}`, // Virtual ID
            userid: user.id,
            amount: 0,
            status: 'ACTIVE',
            createdat: user.createdAt || new Date().toISOString(),
            expiresat: null,
            refundedfrombookingid: null,
            User: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName
            },
            Booking: null,
            ...userTotalsMap[user.id] || { totalCredit: 0, usedCredit: 0, remainingCredit: 0 },
            creditUsed: 0,
            creditRemaining: 0,
            creditOriginal: 0
          });
        }
      });
      
      // Sort enriched credits to maintain consistent order (by user email)
      enrichedCredits.sort((a, b) => {
        const emailA = (a.User?.email || '').toLowerCase();
        const emailB = (b.User?.email || '').toLowerCase();
        return emailA.localeCompare(emailB);
      });
    }

    // Calculate total count: if searching, count all matching users; otherwise count credit records
    let totalCount = count || enrichedCredits.length;
    if (searchedUsers && searchedUsers.length > 0) {
      // When searching, total should be the number of matching users
      totalCount = searchedUsers.length;
    }

    res.json({
      items: enrichedCredits,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
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

// Update user's remaining credits (admin only)
const updateUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newAmount } = req.body;

    console.log('💰 Admin updating user credits:', { userId, newAmount });

    // Validate input
    if (typeof newAmount !== 'number' || newAmount < 0) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    // Get user's current active credits
    const { data: activeCredits, error: fetchError } = await supabase
      .from('usercredits')
      .select('id, amount, status')
      .eq('userid', userId)
      .eq('status', 'ACTIVE')
      .order('createdat', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching user credits:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    // Calculate current remaining credits
    const { data: usages } = await supabase
      .from('creditusage')
      .select('amountused')
      .eq('userid', userId);
    
    const totalUsed = (usages || []).reduce((sum, u) => sum + parseFloat(u.amountused || 0), 0);
    const currentRemaining = (activeCredits || []).reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const currentTotal = currentRemaining + totalUsed;

    console.log('📊 Current credits:', { currentRemaining, totalUsed, currentTotal, newAmount });

    // If new amount is 0, deactivate all credits
    if (newAmount === 0) {
      const { error: deactivateError } = await supabase
        .from('usercredits')
        .update({ status: 'USED', amount: 0 })
        .eq('userid', userId)
        .eq('status', 'ACTIVE');

      if (deactivateError) {
        console.error('❌ Error deactivating credits:', deactivateError);
        return res.status(500).json({ error: 'Failed to update credits' });
      }

      console.log('✅ All credits deactivated');
      return res.json({ 
        message: 'Credits updated successfully', 
        oldAmount: currentRemaining,
        newAmount: 0 
      });
    }

    // Calculate the difference
    const difference = newAmount - currentRemaining;

    if (difference > 0) {
      // Admin is adding more credits - create a new credit entry
      const expiresat = new Date();
      expiresat.setDate(expiresat.getDate() + 30); // 30 days expiry

      const { error: insertError } = await supabase
        .from('usercredits')
        .insert({
          userid: userId,
          amount: difference,
          expiresat: expiresat.toISOString(),
          refundedfrombookingid: null // Admin adjustment, no booking
        });

      if (insertError) {
        console.error('❌ Error adding new credit:', insertError);
        return res.status(500).json({ error: 'Failed to add credits' });
      }

      console.log('✅ Credits added:', difference);
    } else if (difference < 0) {
      // Admin is reducing credits - reduce or deactivate existing credits
      let amountToRemove = Math.abs(difference);
      
      for (const credit of activeCredits) {
        if (amountToRemove <= 0) break;

        const creditAmount = parseFloat(credit.amount);
        
        if (creditAmount <= amountToRemove) {
          // Fully remove this credit
          await supabase
            .from('usercredits')
            .update({ status: 'USED', amount: 0 })
            .eq('id', credit.id);
          
          amountToRemove -= creditAmount;
        } else {
          // Partially reduce this credit
          await supabase
            .from('usercredits')
            .update({ amount: creditAmount - amountToRemove })
            .eq('id', credit.id);
          
          amountToRemove = 0;
        }
      }

      console.log('✅ Credits reduced by:', Math.abs(difference));
    } else {
      console.log('ℹ️ No change in credits');
    }

    res.json({ 
      message: 'Credits updated successfully',
      oldAmount: currentRemaining,
      newAmount: newAmount
    });
  } catch (error) {
    console.error('❌ Error in updateUserCredits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllRefundRequests,
  approveRefund,
  rejectRefund,
  getAllUserCredits,
  getRefundStats,
  updateUserCredits
};
