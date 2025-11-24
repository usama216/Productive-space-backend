const supabase = require("../config/database");

exports.getBookingAnalytics = async (req, res) => {
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

    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .gte('startAt', startDate.toISOString())
      .lte('startAt', endDate.toISOString());

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.confirmedPayment).length;
    const pendingBookings = totalBookings - confirmedBookings;
    const totalRevenue = bookings
      .filter(b => b.confirmedPayment)
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const locationBreakdown = {};
    bookings.forEach(booking => {
      const loc = booking.location || 'Unknown';
      if (!locationBreakdown[loc]) {
        locationBreakdown[loc] = { count: 0, revenue: 0 };
      }
      locationBreakdown[loc].count++;
      if (booking.confirmedPayment) {
        locationBreakdown[loc].revenue += parseFloat(booking.totalAmount || 0);
      }
    });

    const memberTypeBreakdown = {};
    bookings.forEach(booking => {
      const type = booking.memberType || 'regular';
      if (!memberTypeBreakdown[type]) {
        memberTypeBreakdown[type] = { count: 0, revenue: 0 };
      }
      memberTypeBreakdown[type].count++;
      if (booking.confirmedPayment) {
        memberTypeBreakdown[type].revenue += parseFloat(booking.totalAmount || 0);
      }
    });

    const dailyTrends = {};
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyTrends[dateKey] = { bookings: 0, revenue: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    bookings.forEach(booking => {
      const dateKey = new Date(booking.startAt).toISOString().split('T')[0];
      if (dailyTrends[dateKey]) {
        dailyTrends[dateKey].bookings++;
        if (booking.confirmedPayment) {
          dailyTrends[dateKey].revenue += parseFloat(booking.totalAmount || 0);
        }
      }
    });

    res.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageBookingValue: Math.round(averageBookingValue * 100) / 100
      },
      breakdowns: {
        byLocation: locationBreakdown,
        byMemberType: memberTypeBreakdown
      },
      trends: {
        daily: dailyTrends
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: todayBookings } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .gte('startAt', today.toISOString())
      .lt('startAt', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const { data: monthBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .gte('startAt', startOfMonth.toISOString())
      .lte('startAt', now.toISOString())
      .eq('confirmedPayment', true);

    const monthRevenue = monthBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    const { count: upcomingCount } = await supabase
      .from('Booking')
      .select('*', { count: 'exact', head: true })
      .gt('startAt', now.toISOString());

    const { data: pendingBookings } = await supabase
      .from('Booking')
      .select('totalAmount')
      .eq('confirmedPayment', false);

    const pendingAmount = pendingBookings
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

    res.json({
      today: {
        bookings: todayBookings || 0
      },
      thisMonth: {
        revenue: Math.round(monthRevenue * 100) / 100
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
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};

