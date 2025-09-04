const supabase = require('../config/database');

/**
 * Check if an email is associated with a verified student account
 * @route POST /api/student/check-verification
 * @body { email: string }
 * @returns { isStudent: boolean, verificationStatus: string, userData?: object }
 */
const checkStudentVerification = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        message: 'Please provide an email address to check'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    // Check if user exists and get student verification status
    // Select essential columns including name fields
    const { data: user, error } = await supabase
      .from('User')
      .select('id, email, studentVerificationStatus, firstName, lastName')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No user found with this email
        return res.status(200).json({
          isStudent: false,
          verificationStatus: 'NOT_FOUND',
          message: 'No account found with this email address',
          email: email.toLowerCase().trim()
        });
      }
      
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check student verification status'
      });
    }

    // User found - check student verification status
    const isStudent = user.studentVerificationStatus === 'VERIFIED';
    const verificationStatus = user.studentVerificationStatus || 'PENDING';

    // Prepare response data with clearer messages
    let message = '';
    if (isStudent) {
      message = 'This email is associated with a verified student account';
    } else if (verificationStatus === 'PENDING') {
      message = 'This email is available in our records but not registered as a student account';
    } else if (verificationStatus === 'REJECTED') {
      message = 'This email is available in our records but failed to verify';
    } else {
      message = 'This email is available in our records but not registered as a student account';
    }

    // Create concatenated name field
    let fullName = '';
    if (user.firstName && user.lastName) {
      fullName = `${user.firstName} ${user.lastName}`.trim();
    } else if (user.firstName) {
      fullName = user.firstName;
    } else if (user.lastName) {
      fullName = user.lastName;
    } else if (user.name) {
      fullName = user.name;
    }

    const responseData = {
      isStudent,
      verificationStatus,
      email: user.email,
      message,
      name: fullName || null
    };

    // Include additional user data if needed (optional)
    if (req.query.includeUserData === 'true') {
      responseData.userData = {
        id: user.id
      };
      
      // Only include fields if they exist (for backward compatibility)
      if (user.memberType !== undefined) {
        responseData.userData.memberType = user.memberType;
      }
      if (user.studentVerificationDate !== undefined) {
        responseData.userData.studentVerificationDate = user.studentVerificationDate;
      }
      if (user.name !== undefined) {
        responseData.userData.name = user.name;
      }
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Student verification check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check student verification status'
    });
  }
};

/**
 * Get student verification status for multiple emails
 * @route POST /api/student/check-multiple
 * @body { emails: string[] }
 * @returns { results: Array<{email: string, isStudent: boolean, verificationStatus: string}> }
 */
const checkMultipleStudentVerifications = async (req, res) => {
  try {
    const { emails } = req.body;

    // Validate input
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: 'Emails array is required',
        message: 'Please provide an array of email addresses to check'
      });
    }

    if (emails.length > 50) {
      return res.status(400).json({
        error: 'Too many emails',
        message: 'Maximum 50 emails can be checked at once'
      });
    }

    // Validate email formats and remove duplicates
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        error: 'Invalid email formats',
        message: 'Some emails have invalid format',
        invalidEmails
      });
    }

    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(emails.filter(email => email && email.trim()))];
    
    if (uniqueEmails.length === 0) {
      return res.status(400).json({
        error: 'No valid emails',
        message: 'Please provide at least one valid email address'
      });
    }

    // Normalize emails for query
    const normalizedEmails = uniqueEmails.map(email => email.toLowerCase().trim());
    
    // Check verification status for all emails
    // Try with all columns first, then fallback to basic columns if needed
    let { data: users, error } = await supabase
      .from('User')
      .select('email, studentVerificationStatus, firstName, lastName, name')
      .in('email', normalizedEmails);

    // If the query fails, try with just basic columns
    if (error) {
      console.log('⚠️  Full query failed, trying with basic columns...');
      const fallbackQuery = await supabase
        .from('User')
        .select('email, studentVerificationStatus')
        .in('email', normalizedEmails);
      
      if (!fallbackQuery.error) {
        users = fallbackQuery.data;
        error = null;
        console.log('✅ Fallback query successful');
      }
    }

    if (error) {
      console.error('Database error in checkMultipleStudentVerifications:', error);
      console.error('Query details:', {
        table: 'User',
        columns: ['email', 'studentVerificationStatus', 'firstName', 'lastName', 'name'],
        emails: normalizedEmails,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      });
      
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check student verification statuses',
        details: error.message
      });
    }

    // Create a map of found users
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user.email, user.studentVerificationStatus);
    });

    // Build results array with clear messages
    const results = uniqueEmails.map(email => {
      const normalizedEmail = email.toLowerCase().trim();
      const user = users.find(u => u.email === normalizedEmail);
      const verificationStatus = user ? user.studentVerificationStatus : null;
      const isStudent = verificationStatus === 'VERIFIED';
      
      // Create clear message for each email
      let message = '';
      if (isStudent) {
        message = 'This email is associated with a verified student account';
      } else if (verificationStatus === 'PENDING') {
        message = 'This email is available in our records but not registered as a student account';
      } else if (verificationStatus === 'REJECTED') {
        message = 'This email is available in our records but student verification was rejected';
      } else {
        message = 'No account found with this email address';
      }

      // Create concatenated name field
      let fullName = '';
      if (user) {
        if (user.firstName && user.lastName) {
          fullName = `${user.firstName} ${user.lastName}`.trim();
        } else if (user.firstName) {
          fullName = user.firstName;
        } else if (user.lastName) {
          fullName = user.lastName;
        } else if (user.name) {
          fullName = user.name;
        }
      }
      
      return {
        email: normalizedEmail,
        isStudent,
        verificationStatus: verificationStatus || 'NOT_FOUND',
        message,
        name: fullName || null
      };
    });

    return res.status(200).json({
      results,
      totalChecked: uniqueEmails.length,
      totalFound: users.length,
      totalStudents: results.filter(r => r.isStudent).length
    });

  } catch (error) {
    console.error('Multiple student verification check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check student verification statuses'
    });
  }
};

/**
 * Get student verification statistics
 * @route GET /api/student/stats
 * @returns { totalUsers: number, verifiedStudents: number, pendingStudents: number, rejectedStudents: number }
 */
const getStudentVerificationStats = async (req, res) => {
  try {
    // Get total user count
    const { count: totalUsers, error: totalError } = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Total users count error:', totalError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to get user statistics'
      });
    }

    // Get verification status counts
    const { data: verificationStats, error: statsError } = await supabase
      .from('User')
      .select('id'); // Just get IDs to count total users

    if (statsError) {
      console.error('Verification stats error:', statsError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to get verification statistics'
      });
    }

    // Calculate counts
    const stats = {
      totalUsers: totalUsers || 0,
      verifiedStudents: 0,
      pendingStudents: 0,
      rejectedStudents: 0
    };

    // Try to get verification status if the column exists
    try {
      const { data: statusData, error: statusError } = await supabase
        .from('User')
        .select('studentVerificationStatus')
        .limit(1000); // Limit to avoid memory issues

      if (!statusError && statusData) {
        statusData.forEach(user => {
          const status = user.studentVerificationStatus || 'PENDING';
          switch (status) {
            case 'VERIFIED':
              stats.verifiedStudents++;
              break;
            case 'PENDING':
              stats.pendingStudents++;
              break;
            case 'REJECTED':
              stats.rejectedStudents++;
              break;
          }
        });
      }
    } catch (err) {
      console.log('⚠️  Could not get verification status counts:', err.message);
      // Continue with default values
    }

    return res.status(200).json(stats);

  } catch (error) {
    console.error('Student verification stats error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get student verification statistics'
    });
  }
};

module.exports = {
  checkStudentVerification,
  checkMultipleStudentVerifications,
  getStudentVerificationStats
};
