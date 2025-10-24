const crypto = require('crypto');
const supabase = require('../config/database');
const { doorAccessLinkTemplate } = require('../templates/doorAccessLink');
const { sendRawEmail } = require('../utils/email');

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
 * Send door access link via email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendDoorAccessLink = async (req, res) => {
  try {
    const { bookingRef } = req.body;

    // Validate required parameters
    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        message: 'bookingRef is required'
      });
    }

    // First, fetch booking details
    console.log('Searching for booking with ref:', bookingRef);
    const { data: bookingData, error: bookingError } = await supabase
      .from('Booking')
      .select('*')
      .eq('bookingRef', bookingRef)
      .single();

    if (bookingError || !bookingData) {
      console.error('Booking query error:', bookingError);
      console.error('Booking data:', bookingData);
      return res.status(404).json({
        success: false,
        message: 'Booking not found or invalid booking reference',
        debug: {
          bookingRef,
          error: bookingError?.message,
          data: bookingData
        }
      });
    }

    console.log('Booking found:', bookingData.bookingRef, 'User ID:', bookingData.userId);

    // Then fetch user details separately
    console.log('Searching for user with ID:', bookingData.userId);
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('firstName, lastName, email')
      .eq('id', bookingData.userId)
      .single();

    if (userError || !userData) {
      console.error('User query error:', userError);
      console.error('User data:', userData);
      return res.status(404).json({
        success: false,
        message: 'User information not found for this booking',
        debug: {
          userId: bookingData.userId,
          error: userError?.message,
          data: userData
        }
      });
    }

    console.log('User found:', userData.firstName, userData.lastName, userData.email);

    // Add user data to bookingData (keeping Jimmy's variable names)
    bookingData.user = userData;

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

    let token, tokenData, tokenError;

    if (existingToken && !checkError) {
      // Token already exists, return the existing one
      token = existingToken.token;
      tokenData = existingToken;
      tokenError = null;
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
      
      tokenData = result.data;
      tokenError = result.error;
    }

    if (tokenError) {
      console.error('Error storing token:', tokenError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate access link'
      });
    }

    // Generate the access link
    const accessLink = `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'https://productive-space-backend.vercel.app/api'}/door/open-door?token=${token}`;

    // Format dates for email
    const startTime = new Date(bookingData.startAt).toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const endTime = new Date(bookingData.endAt).toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const expiresAt = new Date(bookingData.endAt).toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Prepare email data
    const userName = `${bookingData.user.firstName || ''} ${bookingData.user.lastName || ''}`.trim() || 'Guest';
    const emailData = {
      accessLink,
      bookingRef,
      userName,
      userEmail: bookingData.user.email,
      startTime,
      endTime,
      location: 'Kovan', // Static location as per current setup
      expiresAt
    };

    // Generate email HTML
    const emailHTML = doorAccessLinkTemplate(emailData);

    // Send email
    const emailResult = await sendRawEmail({
      to: bookingData.user.email,
      subject: `🔑 Door Access Link - ${bookingRef} | My Productive Space`,
      html: emailHTML
    });

    if (!emailResult.success) {
      console.error('Error sending email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send access link email'
      });
    }

    res.json({
      success: true,
      message: 'Door access link sent successfully to your email',
      data: {
        emailSent: true,
        recipientEmail: bookingData.user.email,
        accessLink,
        expiresAt
      }
    });

  } catch (error) {
    console.error('Error sending door access link:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  sendDoorAccessLink
};
