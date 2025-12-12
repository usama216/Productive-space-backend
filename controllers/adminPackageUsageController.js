const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

exports.getPackageUsageAnalytics = async (req, res) => {
  try {
    // Get pagination and filter parameters
    const {
      page = 1,
      limit = 20,
      search,
      filterType,
      sortBy = 'usagePercentage',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 Package Usage Analytics called with params:', {
      page, limit, search, filterType, sortBy, sortOrder
    });
   
    const { data: testData, error: testError } = await supabase
      .from('Package')
      .select('count')
      .limit(1);

    if (testError) {
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        message: 'Cannot connect to database',
        details: testError.message
      });
    }

   
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
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch packages',
        details: packagesError.message
      });
    }

  
    if (!packages || packages.length === 0) {
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

    // Build the query with filters
    let query = supabase
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
      `, { count: 'exact' })
      .eq('paymentStatus', 'COMPLETED');

    // Note: Search filter will be applied in-memory after fetching data
    // Supabase doesn't support filtering on joined tables directly

    // Apply package type filter (on main table only)
    if (filterType && filterType !== 'all') {
      query = query.eq('Package.packageType', filterType);
    }

    // Apply sorting
    if (sortBy === 'usagePercentage') {
      // We'll sort by usage percentage after processing the data
      query = query.order('createdAt', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'revenue') {
      query = query.order('totalAmount', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'purchasedAt') {
      query = query.order('createdAt', { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('createdAt', { ascending: sortOrder === 'asc' });
    }

    // Fetch all data first (we'll apply search filter and pagination in memory)
    const { data: allPurchases, error: purchasesError } = await query;

    if (purchasesError) {
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch package purchases',
        details: purchasesError.message
      });
    }

 
    const packageUsages = await Promise.all((allPurchases || []).map(async (purchase) => {
      try {
         const { data: userPasses, error: passesError } = await supabase
           .from('UserPass')
           .select(`
             id,
             totalCount,
             remainingCount,
             status,
             usedat,
             createdat
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

        let totalPasses = 0;
        let usedPasses = 0;
        let lastUsed = null;

         for (const pass of userPasses || []) {
           totalPasses += pass.totalCount || 0;
           usedPasses += (pass.totalCount || 0) - (pass.remainingCount || 0);
           
           if (pass.usedat && (!lastUsed || new Date(pass.usedat) > new Date(lastUsed))) {
             lastUsed = pass.usedat;
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

    // Apply in-memory search filter (contain-based, case-insensitive)
    let filteredPackageUsages = packageUsages;
    if (search) {
      // Sanitize search input to prevent potential issues
      const { sanitizeSearchQuery } = require("../utils/inputSanitizer");
      const sanitizedSearch = sanitizeSearchQuery(search);
      if (sanitizedSearch) {
        const searchLower = sanitizedSearch.toLowerCase();
        // Contain-based search: search in packageName, userName, and userEmail
        // This handles spaces properly - "half day" will match packages containing "half day"
        filteredPackageUsages = packageUsages.filter(pkg => 
          pkg.packageName.toLowerCase().includes(searchLower) ||
          pkg.userName.toLowerCase().includes(searchLower) ||
          pkg.userEmail.toLowerCase().includes(searchLower)
        );
      }
    }

    // Sort by usage percentage if requested
    if (sortBy === 'usagePercentage') {
      filteredPackageUsages.sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.usagePercentage - b.usagePercentage;
        } else {
          return b.usagePercentage - a.usagePercentage;
        }
      });
    }

    // Apply pagination on filtered results
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const totalPurchases = filteredPackageUsages.length;
    const totalPages = Math.ceil(totalPurchases / limitNum);
    const offset = (pageNum - 1) * limitNum;
    
    const paginatedResults = filteredPackageUsages.slice(offset, offset + limitNum);

    const stats = {
      totalPackages: packages.length,
      totalPurchases: totalPurchases,
      totalPasses: filteredPackageUsages.reduce((sum, pkg) => sum + pkg.totalPasses, 0),
      totalUsed: filteredPackageUsages.reduce((sum, pkg) => sum + pkg.usedPasses, 0),
      totalRevenue: filteredPackageUsages.reduce((sum, pkg) => sum + pkg.revenue, 0),
      averageUsage: filteredPackageUsages.length > 0 
        ? filteredPackageUsages.reduce((sum, pkg) => sum + pkg.usagePercentage, 0) / filteredPackageUsages.length 
        : 0
    };

    console.log('🔍 Response data:', {
      packagesCount: paginatedResults.length,
      totalPurchases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalPurchases,
        totalPages: totalPages
      }
    });

    res.json({
      success: true,
      packages: paginatedResults,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalPurchases,
        totalPages: totalPages
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch package usage analytics',
      details: error.message
    });
  }
};


exports.getPackageUsageDetails = async (req, res) => {
  try {
    const { packageId } = req.params;
    
    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: 'Package ID is required'
      });
    }

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
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch package usage details'
    });
  }
};
