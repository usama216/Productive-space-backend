const crypto = require('crypto');
const supabase = require('../config/database');
const TuyaSmartLock = require('../utils/tuyaSmartLock');
const { openDoorSuccessTemplate, openDoorFailTemplate } = require('../templates/openDoor');

/**
 * Calculate booking status based on current time and booking times
 * @param {string} startAt - Booking start time
 * @param {string} endAt - Booking end time
 * @param {boolean} isRefunded - Whether booking is refunded
 * @param {boolean} isCancelled - Whether booking is cancelled
 * @returns {string} - Booking status: 'ongoing', 'today', 'upcoming', 'completed', 'refunded', 'cancelled'
 */
const calculateBookingStatus = (startAt, endAt, isRefunded = false, isCancelled = false) => {
  if (isCancelled) return 'cancelled';
  if (isRefunded) return 'refunded';

  const now = new Date();
  const startTime = new Date(startAt);
  const endTime = new Date(endAt);

  const isOngoing = startTime <= now && endTime > now;
  const isToday = startTime.toDateString() === now.toDateString();
  const isCompleted = endTime <= now;
  const isUpcoming = !isOngoing && !isToday && startTime > now;

  // Priority: ongoing/today first, then upcoming, then completed
  if (isOngoing) return 'ongoing';
  if (isToday) return 'today';
  if (isUpcoming) return 'upcoming';
  return 'completed';
};

/**
 * Get TUYA_SMART_LOCK_ID from database
 * @returns {Promise<string|null>}
 */
const getTuyaSmartLockId = async () => {
  try {
    const { data: setting, error } = await supabase
      .from('TuyaSettings')
      .select('settingValue')
      .eq('settingKey', 'TUYA_SMART_LOCK_ID')
      .eq('isActive', true)
      .single();
    
    if (error || !setting) {
      console.error('Error loading TUYA_SMART_LOCK_ID from database:', error);
      return null;
    }
    
    return setting.settingValue;
  } catch (error) {
    console.error('Error loading TUYA_SMART_LOCK_ID from database:', error);
    return null;
  }
};

/**
 * Get MAX_ACCESS_COUNT from database
 * @returns {Promise<number>} Returns -1 if not found (unlimited access)
 */
const getMaxAccessCount = async () => {
  try {
    const { data: setting, error } = await supabase
      .from('TuyaSettings')
      .select('settingValue')
      .eq('settingKey', 'MAX_ACCESS_COUNT')
      .eq('isActive', true)
      .single();
    
    if (error || !setting) {
      console.warn('MAX_ACCESS_COUNT not found in database, defaulting to -1 (unlimited)');
      return -1; // Default to unlimited if not configured
    }
    
    const value = parseInt(setting.settingValue);
    return isNaN(value) ? -1 : value;
  } catch (error) {
    console.error('Error loading MAX_ACCESS_COUNT from database:', error);
    return -1; // Default to unlimited on error
  }
};

/**
 * Log door access activity to DoorAccessLog table
 * @param {string} bookingRef - Booking reference (can be null for manual tokens)
 * @param {string} token - Access token
 * @param {string} status - Status: 'open', 'error', 'created_success', 'created_fail'
 * @param {string} errorMessage - Error message (optional)
 */
const logDoorAccess = async (bookingRef, token, status, errorMessage = null) => {
  try {
    await supabase
      .from('DoorAccessLog')
      .insert([
        {
          booking_ref: bookingRef,
          token: token || null,
          status: status,
          error_message: errorMessage,
          excute_at: new Date().toISOString()
        }
      ]);
  } catch (error) {
    console.error('Error logging door access:', error);
    // Don't throw error, just log it to avoid breaking the main flow
  }
};
/**
 * Generate a secure access link to open the door
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateOpenLink = async (req, res) => {
  try {
    const { bookingRef } = req.body;

    // Validate required parameters
    if (!bookingRef) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create access link: bookingRef is required. Request body: ${JSON.stringify(req.body)}. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(null, null, 'created_fail', errorMsg);
      return res.status(400).json({
        success: false,
        message: 'bookingRef are required'
      });
    }

    // Fetch booking details from the Booking table
    const { data: bookingData, error: bookingError } = await supabase
      .from('Booking')
      .select('userId, startAt, endAt, refundstatus, deletedAt')
      .eq('bookingRef', bookingRef)
      .single();

    if (bookingError || !bookingData) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create access link: Booking not found. bookingRef: ${bookingRef}. Database error: ${bookingError ? JSON.stringify(bookingError) : 'No data returned'}. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(bookingRef, null, 'created_fail', errorMsg);
      return res.status(404).json({
        success: false,
        message: 'Booking not found or invalid booking reference'
      });
    }

    // Verify that the authenticated user owns this booking
    if (req.user && req.user.id !== bookingData.userId) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create access link: Access denied. User ${req.user.id} does not own booking ${bookingRef}. Booking owner: ${bookingData.userId}`;
      await logDoorAccess(bookingRef, null, 'created_fail', errorMsg);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only generate access links for your own bookings.'
      });
    }

    // Calculate booking status
    const isRefunded = bookingData.refundstatus === 'APPROVED';
    const isCancelled = bookingData.deletedAt !== null;
    const bookingStatus = calculateBookingStatus(
      bookingData.startAt,
      bookingData.endAt,
      isRefunded,
      isCancelled
    );

    // Only allow access for 'ongoing', 'today' or 'upcoming' bookings
    if (bookingStatus !== 'ongoing' && bookingStatus !== 'today' && bookingStatus !== 'upcoming') {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create access link: Invalid booking status. bookingRef: ${bookingRef}. Status: ${bookingStatus}. StartAt: ${bookingData.startAt}. EndAt: ${bookingData.endAt}. IsRefunded: ${isRefunded}. IsCancelled: ${isCancelled}. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(bookingRef, null, 'created_fail', errorMsg);
      return res.status(400).json({
        success: false,
        message: `Access denied. Booking status is '${bookingStatus}'. Only 'ongoing', 'today' or 'upcoming' bookings can generate access links.`
      });
    }

    // Check if token already exists for this booking reference
    const { data: existingToken, error: checkError } = await supabase
      .from('DoorAccessToken')
      .select('*')
      .eq('booking_ref', bookingRef)
      .single();

    let token, data, error;

    if (existingToken && !checkError) {
      // Token already exists, return the existing one
      token = existingToken.token;
      data = existingToken;
      error = null;
    } else {
      // Generate a new secure token
      token = crypto.randomBytes(32).toString('hex');

      // Store token in database with expiration and booking details
      const result = await supabase
        .from('DoorAccessToken')
        .upsert([
          {
            token,
            booking_ref: bookingRef,
            created_at: new Date().toISOString(),
            used: false,
            access_count: 0
          }
        ],
          {
            onConflict: 'booking_ref',
          }
        ).select('*').single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error storing token:', error);
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create access link: Error storing token in database. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Error code: ${error.code || 'N/A'}. Error message: ${error.message || 'Unknown error'}. Error details: ${JSON.stringify(error)}`;
      await logDoorAccess(bookingRef, token, 'created_fail', errorMsg);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate access link'
      });
    }

    // Log successful creation
    await logDoorAccess(bookingRef, token, 'created_success');

    // Calculate additional fields for response
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
    const enableAt = new Date(new Date(bookingData.startAt).getTime() - GRACE_PERIOD_MS);
    const expiresAt = new Date(new Date(bookingData.endAt).getTime() + GRACE_PERIOD_MS);
    const MAX_ACCESS_COUNT = await getMaxAccessCount();
    const maxAccessCount = MAX_ACCESS_COUNT > 0 ? MAX_ACCESS_COUNT : null;
    const unlimitedAccess = MAX_ACCESS_COUNT <= 0;

    res.json({
      success: true,
      message: 'Access link generated successfully',
      data: {
        ...data,
        accessPath: `/open?token=${token}`,
        enableAt: enableAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxAccessCount,
        currentAccessCount: data.access_count,
        unlimitedAccess
      }
    });
  } catch (error) {
    console.error('Error generating open link:', error);
    // Log failed creation attempt with detailed error
    const errorMsg = `Failed to create access link: Internal server error. bookingRef: ${req.body?.bookingRef || 'not provided'}. Error message: ${error.message || 'Unknown error'}. Error stack: ${error.stack || 'N/A'}. User: ${req.user ? req.user.id : 'not authenticated'}`;
    await logDoorAccess(req.body?.bookingRef || null, null, 'created_fail', errorMsg);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Verify token and open the door
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const openDoor = async (req, res) => {
  let token = null;
  let bookingRef = null;
  
  try {
    token = req.query.token;

    if (!token) {
      // Log error: no token provided with detailed info
      const errorMsg = `Failed to open door: No access token provided. Query params: ${JSON.stringify(req.query)}. Request URL: ${req.url}. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(null, null, 'error', errorMsg);
      return res.status(400).send(openDoorFailTemplate('No access token provided. Please use a valid access link.', undefined, undefined));
    }

    // Verify token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('DoorAccessToken')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid token:', tokenError);
      // Log error: invalid token with detailed info
      const errorMsg = `Failed to open door: Invalid token or token not found in database. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Database error: ${tokenError ? JSON.stringify(tokenError) : 'No data returned'}. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(null, token, 'error', errorMsg);
      return res.status(400).send(openDoorFailTemplate('Invalid token. Please request a new access link.', undefined, undefined));
    }

    bookingRef = tokenData.booking_ref;

    let startTime, endTime;

    // Handle different token types
    if (tokenData.manual_created) {
      // Manual token created by admin
      startTime = tokenData.manual_start_time;
      endTime = tokenData.manual_end_time;
      // bookingRef may be null for manual tokens
    } else {
      // Regular token from booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('Booking')
        .select('*')
        .eq('bookingRef', tokenData.booking_ref)
        .single();

      if (bookingError || !bookingData) {
        console.error('Booking not found:', bookingError);
        // Log error: booking not found with detailed info
        const errorMsg = `Failed to open door: Booking not found in database. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Database error: ${bookingError ? JSON.stringify(bookingError) : 'No data returned'}. IP: ${req.ip || 'unknown'}`;
        await logDoorAccess(bookingRef, token, 'error', errorMsg);
        return res.status(400).send(openDoorFailTemplate('Booking not found. Please contact support.', undefined, undefined));
      }

      // Calculate booking status for regular tokens
      const isRefunded = bookingData.refundstatus === 'APPROVED';
      const isCancelled = bookingData.deletedAt !== null;
      const bookingStatus = calculateBookingStatus(
        bookingData.startAt,
        bookingData.endAt,
        isRefunded,
        isCancelled
      );

      // Only allow access for 'ongoing', 'today' or 'upcoming' bookings
      if (bookingStatus !== 'ongoing' && bookingStatus !== 'today' && bookingStatus !== 'upcoming') {
        console.error(`Access denied. Booking status is '${bookingStatus}'`);
        // Log error: invalid booking status with detailed info
        const errorMsg = `Failed to open door: Invalid booking status. bookingRef: ${bookingRef}. Status: ${bookingStatus}. StartAt: ${bookingData.startAt}. EndAt: ${bookingData.endAt}. IsRefunded: ${isRefunded}. IsCancelled: ${isCancelled}. Current time: ${now.toISOString()}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. IP: ${req.ip || 'unknown'}`;
        await logDoorAccess(bookingRef, token, 'error', errorMsg);
        const GRACE_PERIOD_MS_ERROR = 15 * 60 * 1000; // 15 minutes
        const enableAtError = new Date(new Date(bookingData.startAt).getTime() - GRACE_PERIOD_MS_ERROR);
        const expiresAtError = new Date(new Date(bookingData.endAt).getTime() + GRACE_PERIOD_MS_ERROR);
        return res.status(400).send(openDoorFailTemplate(`Access denied. Booking status is '${bookingStatus}'. Only 'ongoing', 'today' or 'upcoming' bookings can access the door.`, enableAtError, expiresAtError));
      }

      startTime = bookingData.startAt;
      endTime = bookingData.endAt;
      bookingRef = tokenData.booking_ref;
    }

    // Check if token is expired (same logic for both types)
    const now = new Date();
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
    const enableAt = new Date(new Date(startTime).getTime() - GRACE_PERIOD_MS);
    const expiresAt = new Date(new Date(endTime).getTime() + GRACE_PERIOD_MS);
    
    if (now < enableAt) {
      console.error('Access has not started yet');
      // Log error: access not started with detailed info
      const timeUntilStart = enableAt.getTime() - now.getTime();
      const errorMsg = `Failed to open door: Access has not started yet. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Start time: ${startTime}. Enable at (with grace period): ${enableAt.toISOString()}. Current time: ${now.toISOString()}. Time until start: ${Math.round(timeUntilStart / 1000 / 60)} minutes. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(bookingRef, token, 'error', errorMsg);
      return res.status(400).send(openDoorFailTemplate('Your access has not started yet. Please wait until your scheduled time.', enableAt, expiresAt));
    }

    if (now > expiresAt) {
      console.error('Token expired');
      // Log error: token expired with detailed info
      const timeSinceExpiry = now.getTime() - expiresAt.getTime();
      const errorMsg = `Failed to open door: Access token has expired. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. End time: ${endTime}. Expires at (with grace period): ${expiresAt.toISOString()}. Current time: ${now.toISOString()}. Time since expiry: ${Math.round(timeSinceExpiry / 1000 / 60)} minutes. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(bookingRef, token, 'error', errorMsg);
      return res.status(400).send(openDoorFailTemplate('Your access token has expired. Please request a new access link.', enableAt, expiresAt));
    }

    // Check if access count limit is reached (only if MAX_ACCESS_COUNT > 0)
    const MAX_ACCESS_COUNT = await getMaxAccessCount();
    if (MAX_ACCESS_COUNT > 0 && tokenData.access_count >= MAX_ACCESS_COUNT) {
      console.error(`Maximum access count reached (${MAX_ACCESS_COUNT} attempts)`);
      // Log error: max access count reached with detailed info
      const errorMsg = `Failed to open door: Maximum access attempts reached. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Current access count: ${tokenData.access_count}. Max allowed: ${MAX_ACCESS_COUNT}. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(bookingRef, token, 'error', errorMsg);
      return res.status(400).send(openDoorFailTemplate(`Maximum access attempts reached (${MAX_ACCESS_COUNT}). Please contact support for assistance.`, enableAt, expiresAt));
    }

    // Get TUYA_SMART_LOCK_ID from database
    const smartLockId = await getTuyaSmartLockId();
    if (!smartLockId) {
      console.error('TUYA_SMART_LOCK_ID is not configured in database');
      // Log error: smart lock not configured with detailed info
      const errorMsg = `Failed to open door: Smart lock system is not properly configured. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. TUYA_SMART_LOCK_ID not found in TuyaSettings table or is inactive. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(bookingRef, token, 'error', errorMsg);
      return res.status(500).send(openDoorFailTemplate('Smart lock system is not properly configured. Please contact support.', enableAt, expiresAt));
    }

    // Initialize Tuya Smart Lock
    const smartLock = new TuyaSmartLock();
    // Attempt to unlock the door (will use device ID from database if not provided)
    const unlockResult = await smartLock.unlockDoor(smartLockId);
    // If you want to test the door opening without the smart lock, you can uncomment the line below
    // const unlockResult = { success: true };

    if (unlockResult.success) {
      // Increment access count for successful door opening
      await supabase
        .from('DoorAccessToken')
        .update({
          used: true,
          access_count: tokenData.access_count + 1,
        })
        .eq('token', token);

      // Log successful door opening
      await logDoorAccess(bookingRef, token, 'open');

      return res.send(openDoorSuccessTemplate(enableAt, expiresAt));
    } else {
      // Log failed door opening with detailed info
      const errorMsg = `Failed to open door: Tuya smart lock unlock failed. bookingRef: ${bookingRef}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Smart lock ID: ${smartLockId}. Unlock result: ${JSON.stringify(unlockResult)}. Error: ${unlockResult.error || 'Unknown error'}. IP: ${req.ip || 'unknown'}`;
      await logDoorAccess(bookingRef, token, 'error', errorMsg);

      return res.send(openDoorFailTemplate(unlockResult.error || 'Failed to unlock the door. Please try again or contact support.', enableAt, expiresAt));
    }

  } catch (error) {
    console.error('Error opening door:', error);
    // Log error: unexpected error with detailed info
    const errorMsg = `Failed to open door: Unexpected error occurred. bookingRef: ${bookingRef || 'null'}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Error message: ${error.message || 'Unknown error'}. Error stack: ${error.stack || 'N/A'}. IP: ${req.ip || 'unknown'}`;
    await logDoorAccess(bookingRef, token, 'error', errorMsg);
    res.status(500).send(openDoorFailTemplate('An unexpected error occurred while trying to open the door. Please try again or contact support.', undefined, undefined));
  }
};

/**
 * Generate a secure access link for admin with manual seat and time
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const adminGenerateOpenLink = async (req, res) => {
  try {
    const { seatNumber, startTime, endTime } = req.body;

    // Validate required parameters
    if (!seatNumber || !startTime || !endTime) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create admin access link: Missing required parameters. Provided: seatNumber=${seatNumber || 'null'}, startTime=${startTime || 'null'}, endTime=${endTime || 'null'}. Request body: ${JSON.stringify(req.body)}. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(null, null, 'created_fail', errorMsg);
      return res.status(400).json({
        success: false,
        message: 'seatNumber, startTime, and endTime are required'
      });
    }

    // Validate seat number format (S1, S2, ..., S15)
    const seatPattern = /^S(1[0-5]|[1-9])$/;
    if (!seatPattern.test(seatNumber)) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create admin access link: Invalid seat number format. Provided: '${seatNumber}'. Expected format: S1-S15. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(null, null, 'created_fail', errorMsg);
      return res.status(400).json({
        success: false,
        message: 'Invalid seat number format. Must be S1-S15 (e.g., S1, S2, S15)'
      });
    }

    // Validate time format and logic
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create admin access link: Invalid date format. startTime: '${startTime}' (parsed: ${isNaN(startDate.getTime()) ? 'INVALID' : startDate.toISOString()}), endTime: '${endTime}' (parsed: ${isNaN(endDate.getTime()) ? 'INVALID' : endDate.toISOString()}). Expected ISO 8601 format. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(null, null, 'created_fail', errorMsg);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use ISO 8601 format (e.g., 2025-01-27T09:00:00Z)'
      });
    }

    if (startDate >= endDate) {
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create admin access link: Invalid time range. startTime: ${startDate.toISOString()}, endTime: ${endDate.toISOString()}. Start time must be before end time. Time difference: ${endDate.getTime() - startDate.getTime()}ms. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(null, null, 'created_fail', errorMsg);
      return res.status(400).json({
        success: false,
        message: 'Start time must be before end time'
      });
    }

    // Check if token already exists for this combination
    const { data: existingToken, error: checkError } = await supabase
      .from('DoorAccessToken')
      .select('*')
      .eq('manual_created', true)
      .eq('seat_number', seatNumber)
      .eq('manual_start_time', new Date(startTime).toISOString())
      .eq('manual_end_time', new Date(endTime).toISOString())
      .single();

    let token, data, error;

    if (existingToken && !checkError) {
      // Token already exists, return the existing one
      token = existingToken.token;
      data = existingToken;
      error = null;
    } else {
      // Generate a new secure token
      token = crypto.randomBytes(32).toString('hex');

      // Store token in database with manual details
      const result = await supabase
        .from('DoorAccessToken')
        .insert([
          {
            token,
            booking_ref: null, // Set booking_ref to null for manual tokens
            created_at: new Date().toISOString(),
            used: false,
            access_count: 0,
            manual_created: true,
            manual_start_time: new Date(startTime).toISOString(),
            manual_end_time: new Date(endTime).toISOString(),
            seat_number: seatNumber
          }
        ]).select('*').single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error storing manual token:', error);
      // Log failed creation attempt with detailed error
      const errorMsg = `Failed to create admin access link: Error storing manual token in database. seatNumber: ${seatNumber}. startTime: ${startTime}. endTime: ${endTime}. Token: ${token ? token.substring(0, 16) + '...' : 'null'}. Error code: ${error.code || 'N/A'}. Error message: ${error.message || 'Unknown error'}. Error details: ${JSON.stringify(error)}. User: ${req.user ? req.user.id : 'not authenticated'}`;
      await logDoorAccess(null, token, 'created_fail', errorMsg);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate access link'
      });
    }

    // Log successful creation
    await logDoorAccess(null, token, 'created_success');

    // Calculate additional fields for response
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
    const enableAt = new Date(new Date(startTime).getTime() - GRACE_PERIOD_MS);
    const expiresAt = new Date(new Date(endTime).getTime() + GRACE_PERIOD_MS);
    const MAX_ACCESS_COUNT = await getMaxAccessCount();
    const maxAccessCount = MAX_ACCESS_COUNT > 0 ? MAX_ACCESS_COUNT : null;
    const unlimitedAccess = MAX_ACCESS_COUNT <= 0;

    res.json({
      success: true,
      message: 'Admin access link generated successfully',
      data: {
        ...data,
        accessPath: `/open?token=${token}`,
        enableAt: enableAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxAccessCount,
        currentAccessCount: data.access_count,
        unlimitedAccess
      }
    });
  } catch (error) {
    console.error('Error generating admin open link:', error);
    // Log failed creation attempt with detailed error
    const errorMsg = `Failed to create admin access link: Internal server error. Request body: ${JSON.stringify(req.body)}. Error message: ${error.message || 'Unknown error'}. Error stack: ${error.stack || 'N/A'}. User: ${req.user ? req.user.id : 'not authenticated'}`;
    await logDoorAccess(null, null, 'created_fail', errorMsg);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  generateOpenLink,
  adminGenerateOpenLink,
  openDoor
};
