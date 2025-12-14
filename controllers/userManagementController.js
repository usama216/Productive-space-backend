const supabase = require("../config/database");
const { sanitizeSearchQuery, sanitizeString, sanitizeNumber, buildSafeOrQuery } = require("../utils/inputSanitizer");

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
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = sanitizeSearchQuery(search);
      if (sanitizedSearch) {
        // Contain-based search: search in firstName, lastName, email, and contactNumber
        // This handles spaces properly - "John Doe" will match users with firstName="John" and lastName="Doe"
        // Using ilike with %value% for contain-based matching (case-insensitive partial match)
        const orConditions = buildSafeOrQuery([
          { field: 'firstName', operator: 'ilike', value: `%${sanitizedSearch}%` },
          { field: 'lastName', operator: 'ilike', value: `%${sanitizedSearch}%` },
          { field: 'email', operator: 'ilike', value: `%${sanitizedSearch}%` },
          { field: 'contactNumber', operator: 'ilike', value: `%${sanitizedSearch}%` }
        ]);
        if (orConditions) {
          query = query.or(orConditions);
        }
      }
    }

    if (memberType) {
      const sanitizedMemberType = sanitizeString(memberType, 20);
      if (sanitizedMemberType) {
        query = query.eq('memberType', sanitizedMemberType);
      }
    }

    if (studentVerificationStatus) {
      const sanitizedStatus = sanitizeString(studentVerificationStatus, 20);
      if (sanitizedStatus) {
        query = query.eq('studentVerificationStatus', sanitizedStatus);
      }
    }

    // Sanitize sortBy to prevent injection
    const allowedSortFields = ['createdAt', 'updatedAt', 'email', 'firstName', 'lastName', 'memberType'];
    const sanitizedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    query = query.order(sanitizedSortBy, { ascending: sortOrder === 'asc' });

    // Sanitize pagination parameters
    const sanitizedPage = sanitizeNumber(page, 1, 1000) || 1;
    const sanitizedLimit = sanitizeNumber(limit, 1, 100) || 20;
    const offset = (sanitizedPage - 1) * sanitizedLimit;
    query = query.range(offset, offset + sanitizedLimit - 1);

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
      .select('id, startAt, endAt, bookingRef')
      .eq('userId', userId);

    if (bookingError) {
      return res.status(500).json({ error: 'Failed to check user bookings' });
    }

    // Check if user has any future or ongoing bookings
    if (userBookings && userBookings.length > 0) {
      const now = new Date();

      // Filter for future and ongoing bookings
      const futureOrOngoingBookings = userBookings.filter(booking => {
        // Ensure UTC by appending 'Z' if not present
        const endAtUTC = booking.endAt.endsWith('Z') ? booking.endAt : booking.endAt + 'Z';
        const endAt = new Date(endAtUTC);

        // If booking end time is in the future, it's either ongoing or upcoming
        return endAt > now;
      });

      if (futureOrOngoingBookings.length > 0) {
        return res.status(400).json({
          error: 'Cannot delete user with future or ongoing bookings',
          message: 'User has active or upcoming bookings. Please cancel them before deleting the account',
          activeBookings: futureOrOngoingBookings.length,
          totalBookings: userBookings.length
        });
      }
    }

    // With ON DELETE CASCADE setup, database will automatically handle related records
    // Just delete the user directly
    const { error: deleteError } = await supabase
      .from('User')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return res.status(500).json({
        error: 'Failed to delete user',
        details: deleteError.message,
        code: deleteError.code
      });
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

/**
 * Change a user's role (memberType)
 * @route PUT /api/admin/users/:userId/role
 * @access Admin only
 */
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole, reason } = req.body;

    console.log('changeUserRole request:', { userId, newRole, reason });

    // Validate newRole
    const validRoles = ['ADMIN', 'STUDENT', 'MEMBER', 'TUTOR', null];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: ADMIN, STUDENT, MEMBER, TUTOR, or null'
      });
    }

    // Get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      console.error('User not found:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if role is actually changing
    if (existingUser.memberType === newRole) {
      return res.status(400).json({
        error: 'User already has this role',
        currentRole: existingUser.memberType
      });
    }

    // Check for active bookings (warning only)
    const { data: activeBookings, error: bookingError } = await supabase
      .from('Booking')
      .select('id, startAt, endAt')
      .eq('userId', userId)
      .gte('endAt', new Date().toISOString());

    const warnings = [];
    if (activeBookings && activeBookings.length > 0) {
      warnings.push(`User has ${activeBookings.length} active booking(s). Role change may affect pricing.`);
    }

    // Update User table
    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update({
        memberType: newRole,
        updatedAt: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update user role:', updateError);
      return res.status(500).json({
        error: 'Failed to update user role',
        details: updateError.message
      });
    }

    // If promoting to ADMIN, update Supabase Auth metadata
    if (newRole === 'ADMIN') {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { user_metadata: { role: 'admin' } }
        );

        if (authError) {
          console.error('Failed to update auth metadata:', authError);
          warnings.push('User role updated in database, but failed to update authentication metadata. User may not have full admin permissions until they log out and log back in.');
        } else {
          console.log('✅ Successfully updated auth metadata for new admin');
        }
      } catch (authErr) {
        console.error('Error updating auth metadata:', authErr);
        warnings.push('Failed to update authentication metadata.');
      }
    }

    // If demoting from ADMIN, remove auth metadata
    if (existingUser.memberType === 'ADMIN' && newRole !== 'ADMIN') {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { user_metadata: { role: null } }
        );

        if (authError) {
          console.error('Failed to remove auth metadata:', authError);
          warnings.push('User role updated in database, but failed to remove authentication metadata.');
        } else {
          console.log('✅ Successfully removed admin auth metadata');
        }
      } catch (authErr) {
        console.error('Error removing auth metadata:', authErr);
        warnings.push('Failed to remove authentication metadata.');
      }
    }

    // If checking to STUDENT, auto-verify the user
    if (newRole === 'STUDENT') {
      try {
        const updateData = {
          studentVerificationStatus: 'VERIFIED',
          studentVerificationDate: new Date().toISOString(), // Required for frontend display
          studentVerifiedAt: new Date().toISOString(), // Keep for consistency with verifyStudentAccount
          studentRejectionReason: null,
          updatedAt: new Date().toISOString()
        };

        const { error: verifyError } = await supabase
          .from('User')
          .update(updateData)
          .eq('id', userId);

        if (verifyError) {
          console.error('Failed to auto-verify student:', verifyError);
          warnings.push('User role changed to STUDENT, but automatic verification failed.');
        } else {
          console.log('✅ User automatically verified as STUDENT');

          // Add verification history for the auto-verification
          const historyData = {
            userId: userId,
            previousStatus: existingUser.studentVerificationStatus || 'PENDING',
            newStatus: 'VERIFIED',
            reason: 'Auto-verified upon role change to STUDENT by admin',
            changedBy: 'admin',
            changedAt: new Date().toISOString()
          };

          await supabase.from('VerificationHistory').insert([historyData]);
        }
      } catch (err) {
        console.error('Error during auto-verification:', err);
        warnings.push('Automatic verification failed.');
      }
    }

    // Record role change history
    const historyData = {
      userId: userId,
      previousRole: existingUser.memberType,
      newRole: newRole,
      reason: reason || 'Admin role change - no reason provided',
      changedBy: 'admin', // TODO: Get from req.user when auth middleware is implemented
      changedAt: new Date().toISOString()
    };

    const { error: historyError } = await supabase
      .from('RoleChangeHistory')
      .insert([historyData]);

    if (historyError) {
      console.error('Failed to record role change history:', historyError);
      // Don't fail the operation if history recording fails
      warnings.push('Role change was successful but failed to record in history.');
    } else {
      console.log('✅ Role change history recorded successfully');
    }

    const response = {
      success: true,
      message: `User role changed from ${existingUser.memberType || 'regular'} to ${newRole || 'regular'}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        memberType: updatedUser.memberType,
        updatedAt: updatedUser.updatedAt
      }
    };

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    console.log('✅ Role change completed successfully');
    res.json(response);

  } catch (err) {
    console.error('changeUserRole error:', err);
    res.status(500).json({
      error: 'Failed to change user role',
      details: err.message
    });
  }
};

// Disable user - prevents login and all activities
exports.disableUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('id, email, disabled')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user to disabled
    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update({
        disabled: true,
        updatedAt: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to disable user:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to disable user',
        details: updateError.message
      });
    }

    res.json({
      success: true,
      message: 'User disabled successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('disableUser error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to disable user',
      details: err.message
    });
  }
};

// Enable user - allows login and activities
exports.enableUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('User')
      .select('id, email, disabled')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user to enabled
    const { data: updatedUser, error: updateError } = await supabase
      .from('User')
      .update({
        disabled: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to enable user:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to enable user',
        details: updateError.message
      });
    }

    res.json({
      success: true,
      message: 'User enabled successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('enableUser error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to enable user',
      details: err.message
    });
  }
};