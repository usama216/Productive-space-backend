const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const PACKAGE_HOUR_LIMITS = {
  'HALF_DAY': 4,
  'FULL_DAY': 8,
  'SEMESTER_BUNDLE': 4
};

const HOURLY_RATES = {
  'STUDENT': 5.00,
  'MEMBER': 6.00,
  'TUTOR': 4.00
};


exports.applyPackageToBooking = async (req, res) => {
  try {
    const { bookingId, packageId, appliedHours } = req.body;

    if (!bookingId || !packageId || !appliedHours) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'bookingId, packageId, and appliedHours are required'
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('Booking')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        message: 'The specified booking does not exist'
      });
    }

    const { data: userPackage, error: packageError } = await supabase
      .from('UserPass')
      .select(`
        *,
        Package (
          id,
          name,
          packageType,
          targetRole
        )
      `)
      .eq('id', packageId)
      .single();

    if (packageError || !userPackage) {
      return res.status(404).json({
        success: false,
        error: 'Package not found',
        message: 'The specified user package does not exist'
      });
    }

    if (userPackage.remainingCount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Package exhausted',
        message: 'This package has no remaining passes'
      });
    }

    if (new Date(userPackage.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Package expired',
        message: 'This package has expired'
      });
    }

    const hourlyRate = HOURLY_RATES[userPackage.Package.targetRole] || 6.00;
    const discountAmount = appliedHours * hourlyRate;

    const { error: updateError } = await supabase
      .from('Booking')
      .update({
        packageDiscountId: userPackage.id,
        packageDiscountAmount: discountAmount,
        totalAmount: booking.totalCost - discountAmount,
        updatedAt: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to apply package discount to booking'
      });
    }

    const { error: packageUpdateError } = await supabase
      .from('UserPass')
      .update({
        remainingCount: userPackage.remainingCount - 1,
        updatedAt: new Date().toISOString()
      })
      .eq('id', packageId);

    if (packageUpdateError) {
      console.error('Error updating package count:', packageUpdateError);
      await supabase
        .from('Booking')
        .update({
          packageDiscountId: null,
          packageDiscountAmount: null,
          totalAmount: booking.totalCost,
          updatedAt: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to update package count'
      });
    }

    const { error: usageError } = await supabase
      .from('BookingPassUse')
      .insert([{
        id: uuidv4(),
        bookingId: bookingId,
        userPassId: packageId,
        minutesApplied: appliedHours * 60,
        usedAt: new Date().toISOString()
      }]);

    if (usageError) {
      console.error('Error creating package usage record:', usageError);
    }

    res.json({
      success: true,
      message: 'Package applied successfully',
      data: {
        bookingId,
        packageId,
        appliedHours,
        discountAmount,
        newTotalAmount: booking.totalCost - discountAmount,
        remainingPackageCount: userPackage.remainingCount - 1
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to apply package to booking'
    });
  }
};


exports.getUserPackagesForBooking = async (req, res) => {
  try {
    const { userId, userRole } = req.params;

    if (!userId || !userRole) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'userId and userRole are required'
      });
    }

    const { data: userPackages, error } = await supabase
      .from('UserPass')
      .select(`
        id,
        packageId,
        passType,
        totalCount,
        remainingCount,
        expiresAt,
        Package (
          id,
          name,
          packageType,
          targetRole,
          price,
          outletFee
        )
      `)
      .eq('userId', userId)
      .eq('status', 'ACTIVE')
      .gt('remainingCount', 0)
      .gte('expiresAt', new Date().toISOString());

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch user packages'
      });
    }

    const applicablePackages = userPackages.filter(pkg => 
      pkg.Package.targetRole === userRole
    );

    res.json({
      success: true,
      packages: applicablePackages.map(pkg => ({
        id: pkg.id,
        packageId: pkg.packageId,
        packageName: pkg.Package.name,
        packageType: pkg.Package.packageType,
        targetRole: pkg.Package.targetRole,
        remainingCount: pkg.remainingCount,
        totalCount: pkg.totalCount,
        expiresAt: pkg.expiresAt
      }))
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to get user packages'
    });
  }
};


exports.calculatePackageDiscount = async (req, res) => {
  try {
    const { totalHours, userRole, packageId } = req.body;

    if (!totalHours || !userRole) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'totalHours and userRole are required'
      });
    }

    const hourlyRate = HOURLY_RATES[userRole] || 6.00;
    const basePrice = totalHours * hourlyRate;

    if (!packageId) {
      return res.json({
        success: true,
        data: {
          totalHours,
          basePrice,
          finalPrice: basePrice,
          skipPayment: false
        }
      });
    }

    const { data: userPackage, error } = await supabase
      .from('UserPass')
      .select(`
        *,
        Package (
          id,
          name,
          packageType,
          targetRole
        )
      `)
      .eq('id', packageId)
      .single();

    if (error || !userPackage) {
      return res.status(404).json({
        success: false,
        error: 'Package not found',
        message: 'The specified package does not exist'
      });
    }

    const packageType = userPackage.Package.packageType;
    const discountHours = PACKAGE_HOUR_LIMITS[packageType] || 0;
    const appliedHours = Math.min(totalHours, discountHours);
    const remainingHours = Math.max(0, totalHours - appliedHours);
    const discountAmount = appliedHours * hourlyRate;
    const finalPrice = remainingHours * hourlyRate;

    res.json({
      success: true,
      data: {
        totalHours,
        basePrice,
        packageDiscount: {
          packageId: userPackage.id,
          packageName: userPackage.Package.name,
          packageType: packageType,
          targetRole: userPackage.Package.targetRole,
          discountHours,
          appliedHours,
          remainingHours,
          discountAmount,
          finalPrice
        },
        finalPrice,
        skipPayment: finalPrice === 0
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to calculate package discount'
    });
  }
};
