const supabase = require('../config/database');

const checkStudentVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        message: 'Please provide an email address to check'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    const { data: user, error } = await supabase
      .from('User')
      .select('id, email, studentVerificationStatus, firstName, lastName')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          isStudent: false,
          verificationStatus: 'NOT_FOUND',
          message: 'No account found with this email address',
          email: email.toLowerCase().trim()
        });
      }
      
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check student verification status'
      });
    }

    const isStudent = user.studentVerificationStatus === 'VERIFIED';
    const verificationStatus = user.studentVerificationStatus || 'PENDING';

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

    if (req.query.includeUserData === 'true') {
      responseData.userData = {
        id: user.id
      };
      
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
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check student verification status'
    });
  }
};

const checkMultipleStudentVerifications = async (req, res) => {
  try {
    const { emails } = req.body;

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        error: 'Invalid email formats',
        message: 'Some emails have invalid format',
        invalidEmails
      });
    }

    const uniqueEmails = [...new Set(emails.filter(email => email && email.trim()))];
    
    if (uniqueEmails.length === 0) {
      return res.status(400).json({
        error: 'No valid emails',
        message: 'Please provide at least one valid email address'
      });
    }

    const normalizedEmails = uniqueEmails.map(email => email.toLowerCase().trim());
    
    let { data: users, error } = await supabase
      .from('User')
      .select('email, studentVerificationStatus, firstName, lastName, name')
      .in('email', normalizedEmails);

    if (error) {
      const fallbackQuery = await supabase
        .from('User')
        .select('email, studentVerificationStatus')
        .in('email', normalizedEmails);
      
      if (!fallbackQuery.error) {
        users = fallbackQuery.data;
        error = null;
      }
    }

    if (error) {
      
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check student verification statuses',
        details: error.message
      });
    }

    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user.email, user.studentVerificationStatus);
    });

    const results = uniqueEmails.map(email => {
      const normalizedEmail = email.toLowerCase().trim();
      const user = users.find(u => u.email === normalizedEmail);
      const verificationStatus = user ? user.studentVerificationStatus : null;
      const isStudent = verificationStatus === 'VERIFIED';
      
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
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check student verification statuses'
    });
  }
};


const getStudentVerificationStats = async (req, res) => {
  try {
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

    const { data: verificationStats, error: statsError } = await supabase
      .from('User')
      .select('id'); 

    if (statsError) {
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to get verification statistics'
      });
    }

    const stats = {
      totalUsers: totalUsers || 0,
      verifiedStudents: 0,
      pendingStudents: 0,
      rejectedStudents: 0
    };

    try {
      const { data: statusData, error: statusError } = await supabase
        .from('User')
        .select('studentVerificationStatus')
        .limit(1000);

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
      console.log('Could not get verification status counts:', err.message);
    }

    return res.status(200).json(stats);

  } catch (error) {
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
