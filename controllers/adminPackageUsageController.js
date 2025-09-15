const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Get package usage analytics for admin dashboard
 */
exports.getPackageUsageAnalytics = async (req, res) => {
  try {
    console.log('📊 Fetching package usage analytics...');
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_KEY,
      supabaseUrl: process.env.SUPABASE_URL?.substring(0, 20) + '...'
    });

    // First, let's test if we can connect to the database
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('Package')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        message: 'Cannot connect to database',
        details: testError.message
      });
    }

    console.log('✅ Database connection successful');

    // Get all packages first (without isActive filter for now)
    const { data: packages, error: packagesError } = await supabase
      .from('Package')
      .select(`
        id,
        name,
        packageType,
        targetRole,
        price,
        createdAt
      `);

    if (packagesError) {
      console.error('Error fetching packages:', packagesError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch packages',
        details: packagesError.message
      });
    }

    console.log(`Found ${packages.length} packages`);

    // If no packages found, return empty data
    if (!packages || packages.length === 0) {
      console.log('No packages found, returning empty data');
      return res.json({
        success: true,
        packages: [],
        stats: {
          totalPackages: 0,
          totalPurchases: 0,
          totalPasses: 0,
          totalUsed: 0,
          totalRevenue: 0,
          averageUsage: 0
        }
      });
    }

    // Get all individual package purchases (not aggregated by package type)
    const { data: allPurchases, error: purchasesError } = await supabase
      .from('PackagePurchase')
      .select(`
        id,
        userId,
        packageId,
        quantity,
        totalAmount,
        paymentStatus,
        paymentMethod,
        createdAt,
        activatedAt,
        expiresAt,
        Package!inner(
          id,
          name,
          packageType,
          targetRole,
          price,
          passCount,
          validityDays
        ),
        User!inner(
          id,
          email,
          firstName,
          lastName,
          memberType
        )
      `)
      .eq('paymentStatus', 'COMPLETED')
      .order('createdAt', { ascending: false });

    if (purchasesError) {
      console.error('Error fetching package purchases:', purchasesError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch package purchases',
        details: purchasesError.message
      });
    }

    console.log(`Found ${allPurchases.length} completed package purchases`);

    // Process each individual package purchase
    const packageUsages = await Promise.all((allPurchases || []).map(async (purchase) => {
      try {
        // Get UserPass records for this specific purchase
        const { data: userPasses, error: passesError } = await supabase
          .from('UserPass')
          .select(`
            id,
            totalCount,
            remainingCount,
            status,
            usedAt,
            createdAt
          `)
          .eq('packagepurchaseid', purchase.id);

        if (passesError) {
          console.error(`Error fetching UserPass for purchase ${purchase.id}:`, passesError);
          return {
            id: purchase.id,
            packageName: purchase.Package.name,
            packageType: purchase.Package.packageType,
            targetRole: purchase.Package.targetRole,
            userName: `${purchase.User.firstName || ''} ${purchase.User.lastName || ''}`.trim() || 'Unknown',
            userEmail: purchase.User.email,
            userMemberType: purchase.User.memberType,
            totalPasses: purchase.Package.passCount || 0,
            usedPasses: 0,
            remainingPasses: purchase.Package.passCount || 0,
            usagePercentage: 0,
            revenue: purchase.totalAmount,
            lastUsed: null,
            purchasedAt: purchase.createdAt,
            activatedAt: purchase.activatedAt,
            expiresAt: purchase.expiresAt,
            quantity: purchase.quantity,
            paymentMethod: purchase.paymentMethod
          };
        }

        // Calculate usage for this specific purchase
        let totalPasses = 0;
        let usedPasses = 0;
        let lastUsed = null;

        for (const pass of userPasses || []) {
          totalPasses += pass.totalCount || 0;
          usedPasses += (pass.totalCount || 0) - (pass.remainingCount || 0);
          
          if (pass.usedAt && (!lastUsed || new Date(pass.usedAt) > new Date(lastUsed))) {
            lastUsed = pass.usedAt;
          }
        }

        const remainingPasses = totalPasses - usedPasses;
        const usagePercentage = totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0;

        return {
          id: purchase.id,
          packageName: purchase.Package.name,
          packageType: purchase.Package.packageType,
          targetRole: purchase.Package.targetRole,
          userName: `${purchase.User.firstName || ''} ${purchase.User.lastName || ''}`.trim() || 'Unknown',
          userEmail: purchase.User.email,
          userMemberType: purchase.User.memberType,
          totalPasses,
          usedPasses,
          remainingPasses,
          usagePercentage,
          revenue: purchase.totalAmount,
          lastUsed,
          purchasedAt: purchase.createdAt,
          activatedAt: purchase.activatedAt,
          expiresAt: purchase.expiresAt,
          quantity: purchase.quantity,
          paymentMethod: purchase.paymentMethod
        };
      } catch (error) {
        console.error(`Error processing purchase ${purchase.id}:`, error);
        return {
          id: purchase.id,
          packageName: purchase.Package?.name || 'Unknown',
          packageType: purchase.Package?.packageType || 'Unknown',
          targetRole: purchase.Package?.targetRole || 'Unknown',
          userName: 'Unknown',
          userEmail: 'Unknown',
          userMemberType: 'Unknown',
          totalPasses: 0,
          usedPasses: 0,
          remainingPasses: 0,
          usagePercentage: 0,
          revenue: 0,
          lastUsed: null,
          purchasedAt: purchase.createdAt,
          activatedAt: purchase.activatedAt,
          expiresAt: purchase.expiresAt,
          quantity: purchase.quantity,
          paymentMethod: purchase.paymentMethod
        };
      }
    }));

    // Calculate overall statistics
    const stats = {
      totalPackages: packages.length,
      totalPurchases: packageUsages.length,
      totalPasses: packageUsages.reduce((sum, pkg) => sum + pkg.totalPasses, 0),
      totalUsed: packageUsages.reduce((sum, pkg) => sum + pkg.usedPasses, 0),
      totalRevenue: packageUsages.reduce((sum, pkg) => sum + pkg.revenue, 0),
      averageUsage: packageUsages.length > 0 
        ? packageUsages.reduce((sum, pkg) => sum + pkg.usagePercentage, 0) / packageUsages.length 
        : 0
    };

    console.log('📊 Package usage analytics calculated:', {
      totalPackages: stats.totalPackages,
      totalPurchases: stats.totalPurchases,
      totalPasses: stats.totalPasses,
      totalUsed: stats.totalUsed,
      averageUsage: stats.averageUsage.toFixed(2) + '%'
    });

    res.json({
      success: true,
      packages: packageUsages,
      stats
    });

  } catch (error) {
    console.error('Error in getPackageUsageAnalytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch package usage analytics',
      details: error.message
    });
  }
};

/**
 * Get individual package usage details
 */
exports.getPackageUsageDetails = async (req, res) => {
  try {
    const { packageId } = req.params;
    
    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: 'Package ID is required'
      });
    }

    // Get package details with all purchases and usage
    const { data: packageData, error: packageError } = await supabase
      .from('Package')
      .select(`
        id,
        name,
        packageType,
        targetRole,
        price,
        description,
        createdAt,
        PackagePurchase!inner(
          id,
          userId,
          quantity,
          totalAmount,
          paymentStatus,
          paymentMethod,
          createdAt,
          activatedAt,
          expiresAt,
          User!inner(
            id,
            email,
            firstName,
            lastName,
            memberType
          ),
          UserPass!inner(
            id,
            totalCount,
            remainingCount,
            status,
            usedAt,
            bookingId,
            locationId,
            startTime,
            endTime,
            createdAt
          )
        )
      `)
      .eq('id', packageId)
      .eq('isActive', true)
      .single();

    if (packageError || !packageData) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    const purchases = packageData.PackagePurchase || [];
    const completedPurchases = purchases.filter(p => p.paymentStatus === 'COMPLETED');

    // Process detailed usage data
    const usageDetails = completedPurchases.map(purchase => {
      const userPasses = purchase.UserPass || [];
      const totalPasses = userPasses.reduce((sum, pass) => sum + (pass.totalCount || 0), 0);
      const usedPasses = userPasses.reduce((sum, pass) => {
        return sum + ((pass.totalCount || 0) - (pass.remainingCount || 0));
      }, 0);
      const remainingPasses = totalPasses - usedPasses;

      return {
        purchaseId: purchase.id,
        user: {
          id: purchase.User.id,
          email: purchase.User.email,
          name: `${purchase.User.firstName || ''} ${purchase.User.lastName || ''}`.trim() || 'Unknown',
          memberType: purchase.User.memberType
        },
        purchaseDetails: {
          quantity: purchase.quantity,
          totalAmount: purchase.totalAmount,
          paymentMethod: purchase.paymentMethod,
          purchasedAt: purchase.createdAt,
          activatedAt: purchase.activatedAt,
          expiresAt: purchase.expiresAt
        },
        usage: {
          totalPasses,
          usedPasses,
          remainingPasses,
          usagePercentage: totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0
        },
        passDetails: userPasses.map(pass => ({
          id: pass.id,
          totalCount: pass.totalCount,
          remainingCount: pass.remainingCount,
          status: pass.status,
          usedAt: pass.usedAt,
          bookingId: pass.bookingId,
          locationId: pass.locationId,
          startTime: pass.startTime,
          endTime: pass.endTime,
          createdAt: pass.createdAt
        }))
      };
    });

    res.json({
      success: true,
      package: {
        id: packageData.id,
        name: packageData.name,
        packageType: packageData.packageType,
        targetRole: packageData.targetRole,
        price: packageData.price,
        description: packageData.description,
        createdAt: packageData.createdAt
      },
      usageDetails,
      summary: {
        totalPurchases: completedPurchases.length,
        totalPasses: usageDetails.reduce((sum, detail) => sum + detail.usage.totalPasses, 0),
        totalUsed: usageDetails.reduce((sum, detail) => sum + detail.usage.usedPasses, 0),
        totalRevenue: completedPurchases.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0),
        averageUsage: usageDetails.length > 0 
          ? usageDetails.reduce((sum, detail) => sum + detail.usage.usagePercentage, 0) / usageDetails.length 
          : 0
      }
    });

  } catch (error) {
    console.error('Error in getPackageUsageDetails:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch package usage details'
    });
  }
};
