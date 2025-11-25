// Student Verification Expiry Helper Functions
// TESTING MODE: 2-day expiration with 1-day warning for testing purposes
// PRODUCTION: Change back to 6-month expiration with 14-day warning (uncomment production lines)

const supabase = require('../config/database');

/**
 * Check if a student's verification has expired (TESTING: 2 days | PRODUCTION: 6 months)
 * @param {string} studentVerifiedAt - ISO date string when student was verified
 * @returns {boolean} - true if expired, false if still valid
 */
function isVerificationExpired(studentVerifiedAt) {
  if (!studentVerifiedAt) return false;
  
  const verifiedDate = new Date(studentVerifiedAt);
  const expiryTime = new Date(verifiedDate);
  
  // TESTING: 2 days expiry for testing purposes
  expiryTime.setDate(expiryTime.getDate() + 2);
  
  // PRODUCTION: 6 months expiry (uncomment when ready for production)
  // expiryTime.setMonth(expiryTime.getMonth() + 6);
  
  const now = new Date();
  return now >= expiryTime;
}

/**
 * Calculate days remaining until verification expires (TESTING: 2 days | PRODUCTION: 6 months)
 * @param {string} studentVerifiedAt - ISO date string when student was verified
 * @returns {number} - days remaining (negative if expired)
 */
function getDaysUntilExpiry(studentVerifiedAt) {
  if (!studentVerifiedAt) return 0;
  
  const verifiedDate = new Date(studentVerifiedAt);
  const expiryTime = new Date(verifiedDate);
  
  // TESTING: 2 days expiry for testing purposes
  expiryTime.setDate(expiryTime.getDate() + 2);
  
  // PRODUCTION: 6 months expiry (uncomment when ready for production)
  // expiryTime.setMonth(expiryTime.getMonth() + 6);
  
  const now = new Date();
  const diffTime = expiryTime.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Get verification expiry date (TESTING: 2 days | PRODUCTION: 6 months)
 * @param {string} studentVerifiedAt - ISO date string when student was verified
 * @returns {Date|null} - expiry date or null if not verified
 */
function getExpiryDate(studentVerifiedAt) {
  if (!studentVerifiedAt) return null;
  
  const verifiedDate = new Date(studentVerifiedAt);
  const expiryTime = new Date(verifiedDate);
  
  // TESTING: 2 days expiry for testing purposes
  expiryTime.setDate(expiryTime.getDate() + 2);
  
  // PRODUCTION: 6 months expiry (uncomment when ready for production)
  // expiryTime.setMonth(expiryTime.getMonth() + 6);
  
  return expiryTime;
}

/**
 * Check if verification is expiring soon (within 1 day for 2-day expiry)
 * @param {string} studentVerifiedAt - ISO date string when student was verified
 * @returns {boolean} - true if expiring within warning period
 */
function isExpiringSoon(studentVerifiedAt) {
  if (!studentVerifiedAt) return false;
  
  const verifiedDate = new Date(studentVerifiedAt);
  const expiryTime = new Date(verifiedDate);
  
  // TESTING: 2 days expiry for testing purposes
  expiryTime.setDate(expiryTime.getDate() + 2);
  
  // PRODUCTION: 6 months expiry (uncomment when ready for production)
  // expiryTime.setMonth(expiryTime.getMonth() + 6);
  
  const now = new Date();
  const daysRemaining = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  // TESTING: Show "expiring soon" warning if less than 1 day remaining
  return daysRemaining > 0 && daysRemaining <= 1;
  
  // PRODUCTION: Show "expiring soon" if less than 2 weeks (14 days) remaining (uncomment when ready)
  // return daysRemaining > 0 && daysRemaining <= 14;
}

/**
 * Convert expired student accounts to regular members
 * @returns {Object} - { success: boolean, converted: number, errors: array }
 */
async function convertExpiredStudents() {
  console.log('🔄 Starting expired student verification check...');
  
  try {
    // Get all verified students
    const { data: verifiedStudents, error: fetchError } = await supabase
      .from('User')
      .select('id, email, firstName, lastName, memberType, studentVerificationStatus, studentVerifiedAt, studentVerificationDate')
      .eq('memberType', 'STUDENT')
      .eq('studentVerificationStatus', 'VERIFIED');

    if (fetchError) {
      console.error('❌ Error fetching verified students:', fetchError);
      return { success: false, converted: 0, errors: [fetchError.message] };
    }

    if (!verifiedStudents || verifiedStudents.length === 0) {
      console.log('✅ No verified students found to check');
      return { success: true, converted: 0, errors: [] };
    }

    console.log(`📊 Found ${verifiedStudents.length} verified students to check`);

    const expiredStudents = [];
    const errors = [];

    // Check each student for expiration
    for (const student of verifiedStudents) {
      // Use studentVerifiedAt if available, otherwise fall back to studentVerificationDate
      const verifiedAt = student.studentVerifiedAt || student.studentVerificationDate;
      
      if (!verifiedAt) {
        console.log(`⚠️ Student ${student.email} has no verification date, skipping...`);
        continue;
      }

      if (isVerificationExpired(verifiedAt)) {
        expiredStudents.push(student);
        console.log(`⏰ Student ${student.email} verification expired (verified on ${verifiedAt})`);
      }
    }

    console.log(`🔍 Found ${expiredStudents.length} expired student verifications`);

    // Convert expired students to members
    for (const student of expiredStudents) {
      try {
        // Update user to MEMBER
        const { error: updateError } = await supabase
          .from('User')
          .update({
            memberType: 'MEMBER',
            studentVerificationStatus: 'NA',
            updatedAt: new Date().toISOString()
          })
          .eq('id', student.id);

        if (updateError) {
          console.error(`❌ Error converting student ${student.email}:`, updateError);
          errors.push({ userId: student.id, email: student.email, error: updateError.message });
          continue;
        }

        // Record in verification history
        const historyData = {
          userId: student.id,
          previousStatus: 'VERIFIED',
          newStatus: 'NA',
          reason: 'Student verification expired after 2 days (testing mode) - auto-converted to Member',
          changedBy: 'system',
          changedAt: new Date().toISOString()
        };

        const { error: historyError } = await supabase
          .from('VerificationHistory')
          .insert([historyData]);

        if (historyError) {
          console.error(`⚠️ Error recording history for ${student.email}:`, historyError);
          // Don't fail the operation if history fails
        }

        console.log(`✅ Successfully converted ${student.email} to Member`);
      } catch (err) {
        console.error(`❌ Error processing student ${student.email}:`, err);
        errors.push({ userId: student.id, email: student.email, error: err.message });
      }
    }

    const result = {
      success: true,
      converted: expiredStudents.length - errors.length,
      totalChecked: verifiedStudents.length,
      expired: expiredStudents.length,
      errors
    };

   
    return result;

  } catch (err) {
   
    return { success: false, converted: 0, errors: [err.message] };
  }
}

/**
 * Get user verification expiry information
 * @param {string} userId - User ID
 * @returns {Object} - Verification expiry details
 */
async function getUserVerificationExpiry(userId) {
  try {
    const { data: user, error } = await supabase
      .from('User')
      .select('memberType, studentVerificationStatus, studentVerifiedAt, studentVerificationDate')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return { error: 'User not found' };
    }

    if (user.memberType !== 'STUDENT' || user.studentVerificationStatus !== 'VERIFIED') {
      return {
        isStudent: false,
        isVerified: false,
        message: 'User is not a verified student'
      };
    }

    const verifiedAt = user.studentVerifiedAt || user.studentVerificationDate;
    
    if (!verifiedAt) {
      return {
        isStudent: true,
        isVerified: true,
        hasExpiryDate: false,
        message: 'Verification date not available'
      };
    }

    const expiryDate = getExpiryDate(verifiedAt);
    const daysRemaining = getDaysUntilExpiry(verifiedAt);
    const expired = isVerificationExpired(verifiedAt);
    const expiringSoon = isExpiringSoon(verifiedAt);

    return {
      isStudent: true,
      isVerified: true,
      hasExpiryDate: true,
      verifiedAt,
      expiryDate: expiryDate?.toISOString(),
      daysRemaining,
      expired,
      expiringSoon,
      message: expired 
        ? 'Verification has expired. Please verify again to maintain student status.'
        : expiringSoon
        ? `Your student verification expire in ${daysRemaining} days.`
        : `Verification valid for ${daysRemaining} more days.`
    };

  } catch (err) {
    console.error('Error getting user verification expiry:', err);
    return { error: 'Failed to get verification expiry information' };
  }
}

module.exports = {
  isVerificationExpired,
  getDaysUntilExpiry,
  getExpiryDate,
  isExpiringSoon,
  convertExpiredStudents,
  getUserVerificationExpiry
};

