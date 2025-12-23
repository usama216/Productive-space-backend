const supabase = require("../config/database");

exports.getUserBookings = async (req, res) => {
  try {
    // AUTH-001 Fix: Use authenticated user's ID instead of req.body to prevent IDOR
    const userId = req.user.id;
    const {
      page = 1,
      limit = 1000,
      status,
      paymentStatus,
      sortBy = 'startAt',
      sortOrder = 'desc'
    } = req.query;

    let query = supabase
      .from('Booking')
      .select('*', { count: 'exact' })
      .eq('userId', userId)
      .or('confirmedPayment.eq.true,refundstatus.eq.APPROVED,extensionamounts.not.is.null') // Include confirmed payments, refunded bookings, AND extension bookings
      .is('deletedAt', null); // Exclude deleted bookings 

    if (status) {
      const now = new Date().toISOString();
      if (status === 'upcoming') {
        query = query.gt('startAt', now);
      } else if (status === 'ongoing') {
        query = query.lte('startAt', now).gt('endAt', now);
      } else if (status === 'completed') {
        query = query.lt('endAt', now);
      } else if (status === 'today') {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
        query = query.gte('startAt', startOfDay).lte('startAt', endOfDay);
      }
    }

    if (paymentStatus) {
      if (paymentStatus === 'paid') {
        query = query.or('confirmedPayment.eq.true,refundstatus.eq.APPROVED'); // Include confirmed payments AND refunded bookings
      } else if (paymentStatus === 'unpaid') {
        query = query.eq('confirmedPayment', false).neq('refundstatus', 'APPROVED'); // Exclude refunded bookings from unpaid
      }
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch user bookings', details: error.message });
    }

    // Map database fields to camelCase for consistency
    bookings.forEach(booking => {
      if (booking.promocodeid && !booking.promoCodeId) {
        booking.promoCodeId = booking.promocodeid;
      }
      if (booking.discountamount !== undefined && booking.discountAmount === undefined) {
        booking.discountAmount = booking.discountamount;
      }
    });

    const promoCodeIds = bookings
      .filter(b => b.promoCodeId)
      .map(b => b.promoCodeId);
    
    let promoCodeData = {};
    if (promoCodeIds.length > 0) {
      const { data: promoCodes, error: promoError } = await supabase
        .from('PromoCode')
        .select('id, code, discountAmount')
        .in('id', promoCodeIds);
      
      if (!promoError && promoCodes) {
        promoCodes.forEach(promo => {
          promoCodeData[promo.id] = promo;
        });
      }
    }

    // Fetch payment methods for bookings with paymentId
    const paymentIds = bookings
      .filter(b => b.paymentId)
      .map(b => b.paymentId);
    
    let paymentMethodData = {};
    if (paymentIds.length > 0) {
      const { data: payments, error: paymentError } = await supabase
        .from('Payment')
        .select('id, paymentMethod')
        .in('id', paymentIds);
      
      if (!paymentError && payments) {
        payments.forEach(payment => {
          paymentMethodData[payment.id] = payment.paymentMethod;
        });
      }
    }

    // Fetch discount history for all bookings
    const bookingIds = bookings.map(b => b.id);
    let discountHistoryData = {};
    
    if (bookingIds.length > 0) {
      const { data: discountHistory, error: discountError } = await supabase
        .from('BookingDiscountHistory')
        .select('*')
        .in('bookingId', bookingIds)
        .order('appliedAt', { ascending: true });
      
      if (!discountError && discountHistory) {
        // Group by bookingId
        discountHistory.forEach(discount => {
          if (!discountHistoryData[discount.bookingId]) {
            discountHistoryData[discount.bookingId] = [];
          }
          discountHistoryData[discount.bookingId].push(discount);
        });
      }
    }

    const now = new Date();
    const bookingsWithStatus = bookings.map(booking => {
      // Ensure UTC timestamps have 'Z' suffix for proper timezone handling
      const startAtUTC = booking.startAt.endsWith('Z') ? booking.startAt : booking.startAt + 'Z';
      const endAtUTC = booking.endAt.endsWith('Z') ? booking.endAt : booking.endAt + 'Z';
      
      const startAt = new Date(startAtUTC);
      const endAt = new Date(endAtUTC);
      
      const isRefunded = booking.refundstatus === 'APPROVED';
      const isCancelled = booking.deletedAt !== null;
      const isOngoing = !isCancelled && !isRefunded && startAt <= now && endAt > now;
      const isToday = !isCancelled && !isRefunded && startAt.toDateString() === now.toDateString();
      const isCompleted = !isCancelled && !isRefunded && endAt <= now;
      const isUpcoming = !isCancelled && !isRefunded && !isOngoing && !isToday && startAt > now;
      
      const durationMs = endAt.getTime() - startAt.getTime();
      const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 100) / 100;
      
      let timeUntilBooking = null;
      if (isUpcoming) {
        const remainingMs = startAt.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        timeUntilBooking = `${remainingHours}h ${remainingMinutes}m`;
      }

      const promoCode = booking.promoCodeId ? promoCodeData[booking.promoCodeId] : null;
      const paymentMethod = booking.paymentId ? paymentMethodData[booking.paymentId] : null;
      const discountHistory = discountHistoryData[booking.id] || [];
      
      // Calculate total discounts by type and action from discount history
      const discountSummary = {
        totalDiscount: 0,
        byType: { CREDIT: 0, PASS: 0, PROMO_CODE: 0 },
        byAction: { ORIGINAL_BOOKING: 0, RESCHEDULE: 0, EXTENSION: 0, MODIFICATION: 0 }
      };
      
      discountHistory.forEach(discount => {
        const amount = parseFloat(discount.discountAmount || 0);
        discountSummary.totalDiscount += amount;
        discountSummary.byType[discount.discountType] = (discountSummary.byType[discount.discountType] || 0) + amount;
        discountSummary.byAction[discount.actionType] = (discountSummary.byAction[discount.actionType] || 0) + amount;
      });

      return {
        ...booking,
        startAt: startAtUTC,  // Return with UTC suffix
        endAt: endAtUTC,      // Return with UTC suffix
        isUpcoming,
        isOngoing,
        isCompleted,
        isToday,
        durationHours,
        timeUntilBooking,
        // Priority: refunded by admin first, then cancelled by admin, then cancelled, then ongoing/today, then upcoming, then completed
        status: isRefunded && booking.refundapprovedby === 'admin' ? 'Refunded by Admin' 
                : isRefunded ? 'refunded' 
                : isCancelled && booking.cancelledBy === 'admin' ? 'Cancelled by Admin'
                : isCancelled ? 'cancelled' 
                : isOngoing ? 'ongoing' 
                : isToday ? 'today' 
                : isUpcoming ? 'upcoming' 
                : 'completed',
        PromoCode: promoCode,
        paymentMethod: paymentMethod,
        // Add discount tracking data
        discountHistory: discountHistory,
        discountSummary: discountSummary
      };
    });

    const totalBookings = count || 0;
    const upcomingBookings = bookingsWithStatus.filter(b => b.isUpcoming).length;
    const ongoingBookings = bookingsWithStatus.filter(b => b.isOngoing).length;
    const completedBookings = bookingsWithStatus.filter(b => b.isCompleted).length;
    const totalSpent = bookingsWithStatus
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const pendingPayments = bookingsWithStatus
      .filter(b => !b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    res.json({
      userId,
      bookings: bookingsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalBookings,
        totalPages: Math.ceil(totalBookings / limit)
      },
      summary: {
        totalBookings,
        upcomingBookings,
        ongoingBookings,
        completedBookings,
        totalSpent: Math.round(totalSpent * 100) / 100,
        pendingPayments: Math.round(pendingPayments * 100) / 100
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user bookings', details: err.message });
  }
};

exports.getUserBookingStats = async (req, res) => {
  try {
    // AUTH-001 Fix: Use authenticated user's ID instead of req.body to prevent IDOR
    const userId = req.user.id;

    const now = new Date().toISOString();

    const { count: upcomingCount, error: upcomingError } = await supabase
      .from("Booking")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .or('confirmedPayment.eq.true,refundstatus.eq.APPROVED') // Include confirmed payments AND refunded bookings
      .gte("startAt", now);

    if (upcomingError) {
      console.error(upcomingError);
      return res.status(400).json({ error: upcomingError.message });
    }

    const { count: pastCount, error: pastError } = await supabase
      .from("Booking")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .or('confirmedPayment.eq.true,refundstatus.eq.APPROVED') // Include confirmed payments AND refunded bookings
      .lt("endAt", now);

    if (pastError) {
      return res.status(400).json({ error: pastError.message });
    }

    res.status(200).json({
      userId,
      upcomingBookings: upcomingCount || 0,
      pastBookings: pastCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getUserBookingAnalytics = async (req, res) => {
  try {
    // AUTH-001 Fix: Use authenticated user's ID instead of req.body to prevent IDOR
    const userId = req.user.id;
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

    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .eq('userId', userId)
      .gte('startAt', startDate.toISOString())
      .lte('startAt', endDate.toISOString());

    if (error) {
      console.error('getUserBookingAnalytics error:', error);
      return res.status(500).json({ error: 'Failed to fetch user analytics' });
    }

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.confirmedPayment).length;
    const pendingBookings = totalBookings - confirmedBookings;
    const totalSpent = bookings
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const averageBookingValue = totalBookings > 0 ? totalSpent / totalBookings : 0;

    const locationBreakdown = {};
    bookings.forEach(booking => {
      const loc = booking.location || 'Unknown';
      if (!locationBreakdown[loc]) {
        locationBreakdown[loc] = { count: 0, spent: 0 };
      }
      locationBreakdown[loc].count++;
      if (booking.confirmedPayment) {
        locationBreakdown[loc].spent += parseFloat(booking.totalAmount || 0);
      }
    });

    const dailyTrends = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyTrends[dateKey] = { bookings: 0, spent: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    bookings.forEach(booking => {
      const dateKey = new Date(booking.startAt).toISOString().split('T')[0];
      if (dailyTrends[dateKey]) {
        dailyTrends[dateKey].bookings++;
        if (booking.confirmedPayment) {
          dailyTrends[dateKey].spent += parseFloat(booking.totalAmount || 0);
        }
      }
    });

    res.json({
      userId,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        totalSpent: Math.round(totalSpent * 100) / 100,
        averageBookingValue: Math.round(averageBookingValue * 100) / 100
      },
      breakdowns: {
        byLocation: locationBreakdown
      },
      trends: {
        daily: dailyTrends
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
};

exports.getUserDashboardSummary = async (req, res) => {
  try {
    // AUTH-001 Fix: Use authenticated user's ID instead of req.body to prevent IDOR
    const userId = req.user.id;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: todayBookings } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId) 
      .gte('startAt', today.toISOString())
      .lt('startAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const { data: monthBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .eq('userId', userId)
      .gte('startAt', startOfMonth.toISOString())
      .lte('startAt', now.toISOString())
      .eq('confirmedPayment', true);

    const monthSpent = monthBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    const { count: upcomingCount } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('confirmedPayment', true) 
      .gt('startAt', now.toISOString());

    const pendingAmount = 0;

    res.json({
      userId,
      today: {
        bookings: todayBookings || 0
      },
      thisMonth: {
        spent: Math.round(monthSpent * 100) / 100
      },
      upcoming: {
        count: upcomingCount || 0
      },
      pending: {
        amount: Math.round(pendingAmount * 100) / 100
      },
      lastUpdated: now.toISOString()
    });

  } catch (err) {
    console.error('getUserDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch user dashboard summary' });
  }
};

