const supabase = require("../config/database");

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

