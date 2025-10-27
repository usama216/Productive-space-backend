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

// Maximum number of door access attempts allowed per token
const MAX_ACCESS_COUNT = process.env.MAX_ACCESS_COUNT || -1;
const TUYA_SMART_LOCK_ID = process.env.TUYA_SMART_LOCK_ID;
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
      return res.status(400).json({
        success: false,
        message: 'bookingRef are required'
      });
    }

    // Fetch booking details from the Booking table
    const { data: bookingData, error: bookingError } = await supabase
      .from('Booking')
      .select('startAt, endAt, refundstatus, deletedAt')
      .eq('bookingRef', bookingRef)
      .single();

    if (bookingError || !bookingData) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or invalid booking reference'
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
      return res.status(500).json({
        success: false,
        message: 'Failed to generate access link'
      });
    }

    // Calculate additional fields for response
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
    const enableAt = new Date(new Date(bookingData.startAt).getTime() - GRACE_PERIOD_MS);
    const expiresAt = new Date(new Date(bookingData.endAt).getTime() + GRACE_PERIOD_MS);
    const maxAccessCount = MAX_ACCESS_COUNT > 0 ? MAX_ACCESS_COUNT : null;
    const unlimitedAccess = MAX_ACCESS_COUNT <= 0;

    res.json({
      success: true,
      message: 'Access link generated successfully',
      data: {
        ...data,
        accessPath: `/door/open-door?token=${token}`,
        enableAt: enableAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxAccessCount,
        currentAccessCount: data.access_count,
        unlimitedAccess
      }
    });
  } catch (error) {
    console.error('Error generating open link:', error);
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
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(openDoorFailTemplate('No access token provided. Please use a valid access link.'));
    }

    // Verify token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('DoorAccessToken')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid or expired token:', tokenError);
      return res.status(400).send(openDoorFailTemplate('Invalid or expired access token. Please request a new access link.'));
    }

    let startTime, endTime, bookingRef;

    // Handle different token types
    if (tokenData.manual_created) {
      // Manual token created by admin
      startTime = tokenData.manual_start_time;
      endTime = tokenData.manual_end_time;
      bookingRef = tokenData.booking_ref;
    } else {
      // Regular token from booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('Booking')
        .select('*')
        .eq('bookingRef', tokenData.booking_ref)
        .single();

      if (bookingError || !bookingData) {
        console.error('Booking not found:', bookingError);
        return res.status(400).send(openDoorFailTemplate('Booking not found. Please contact support.'));
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
        return res.status(400).send(openDoorFailTemplate(`Access denied. Booking status is '${bookingStatus}'. Only 'ongoing', 'today' or 'upcoming' bookings can access the door.`));
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
      return res.status(400).send(openDoorFailTemplate('Your access has not started yet. Please wait until your scheduled time.'));
    }

    if (now > expiresAt) {
      console.error('Token expired');
      return res.status(400).send(openDoorFailTemplate('Your access token has expired. Please request a new access link.'));
    }

    // Check if access count limit is reached (only if MAX_ACCESS_COUNT > 0)
    if (MAX_ACCESS_COUNT > 0 && tokenData.access_count >= MAX_ACCESS_COUNT) {
      console.error(`Maximum access count reached (${MAX_ACCESS_COUNT} attempts)`);
      return res.status(400).send(openDoorFailTemplate(`Maximum access attempts reached (${MAX_ACCESS_COUNT}). Please contact support for assistance.`));
    }

    // Check if TUYA_SMART_LOCK_ID is configured
    if (!TUYA_SMART_LOCK_ID) {
      console.error('TUYA_SMART_LOCK_ID is not configured');
      return res.status(500).send(openDoorFailTemplate('Smart lock system is not properly configured. Please contact support.'));
    }

    // Initialize Tuya Smart Lock
    const smartLock = new TuyaSmartLock();
    // Attempt to unlock the door
    const unlockResult = await smartLock.unlockDoor();
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
      await supabase
        .from('DoorAccessLog')
        .insert([
          {
            booking_ref: tokenData.booking_ref,
            token: token,
            status: 'success',
            excute_at: new Date().toISOString()
          }
        ]);

      return res.send(openDoorSuccessTemplate());
    } else {
      // Log failed door opening
      await supabase
        .from('DoorAccessLog')
        .insert([
          {
            booking_ref: tokenData.booking_ref,
            token: token,
            status: 'failed',
            error_message: unlockResult.error,
            excute_at: new Date().toISOString()
          }
        ]);

      return res.send(openDoorFailTemplate(unlockResult.error || 'Failed to unlock the door. Please try again or contact support.'));
    }

  } catch (error) {
    console.error('Error opening door:', error);
    res.status(500).send(openDoorFailTemplate('An unexpected error occurred while trying to open the door. Please try again or contact support.'));
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
      return res.status(400).json({
        success: false,
        message: 'seatNumber, startTime, and endTime are required'
      });
    }

    // Validate seat number format (S1, S2, ..., S15)
    const seatPattern = /^S(1[0-5]|[1-9])$/;
    if (!seatPattern.test(seatNumber)) {
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
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use ISO 8601 format (e.g., 2025-01-27T09:00:00Z)'
      });
    }

    if (startDate >= endDate) {
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
      return res.status(500).json({
        success: false,
        message: 'Failed to generate access link'
      });
    }

    // Calculate additional fields for response
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
    const enableAt = new Date(new Date(startTime).getTime() - GRACE_PERIOD_MS);
    const expiresAt = new Date(new Date(endTime).getTime() + GRACE_PERIOD_MS);
    const maxAccessCount = MAX_ACCESS_COUNT > 0 ? MAX_ACCESS_COUNT : null;
    const unlimitedAccess = MAX_ACCESS_COUNT <= 0;

    res.json({
      success: true,
      message: 'Admin access link generated successfully',
      data: {
        ...data,
        accessPath: `/door/open-door?token=${token}`,
        enableAt: enableAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxAccessCount,
        currentAccessCount: data.access_count,
        unlimitedAccess
      }
    });
  } catch (error) {
    console.error('Error generating admin open link:', error);
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
