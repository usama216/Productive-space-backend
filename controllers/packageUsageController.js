const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.getPackageUsageData = async (req, res) => {
  try {
    const { search } = req.query;
   
    // Build query
    let query = supabase
      .from('PackagePurchase')
      .select(`
        id,
        userId,
        packageId,
        totalAmount,
        paymentStatus,
        activatedAt,
        expiresAt,
        createdAt,
        Package (
          id,
          name,
          packageType,
          targetRole,
          passCount
        ),
        User (
          id,
          email,
          firstName,
          lastName
        ),
        UserPass (
          id,
          passtype,
          hours,
          status,
          usedat,
          bookingid,
          locationid
        )
      `)
      .eq('paymentStatus', 'COMPLETED')
      .eq('isActive', true);

    // Apply search filter if provided
    // Note: Supabase doesn't support direct filtering on joined tables
    // We'll fetch all and filter in memory for now
    query = query.order('createdAt', { ascending: false });

    const { data: purchases, error: purchasesError } = await query;

    if (purchasesError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch package purchases',
        details: purchasesError.message
      });
    }

    const usageData = purchases.map(purchase => {
      let totalPasses = 0;
      let usedPasses = 0;
      let activePasses = 0;
      let expiredPasses = 0;
      
      if (purchase.UserPass && purchase.UserPass.length > 0) {
        purchase.UserPass.forEach(pass => {
          totalPasses += 1;
          if (pass.status === 'USED') {
            usedPasses += 1;
          } else if (pass.status === 'ACTIVE') {
            activePasses += 1;
          } else if (pass.status === 'EXPIRED') {
            expiredPasses += 1;
          }
        });
      } else {
        totalPasses = purchase.Package?.passCount || 0;
        activePasses = totalPasses; 
      }
      
      const isExpired = purchase.expiresAt ? new Date() > new Date(purchase.expiresAt) : false;
      const usagePercentage = totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0;

      return {
        id: purchase.id,
        userId: purchase.userId,
        userName: `${purchase.User?.firstName || ''} ${purchase.User?.lastName || ''}`.trim() || purchase.User?.email?.split('@')[0] || 'Unknown',
        userEmail: purchase.User?.email || 'Unknown',
        packageName: purchase.Package?.name || 'Unknown Package',
        packageType: purchase.Package?.packageType || 'UNKNOWN',
        targetRole: purchase.Package?.targetRole || 'UNKNOWN',
        totalPasses,
        usedPasses,
        activePasses,
        expiredPasses,
        totalAmount: parseFloat(purchase.totalAmount || 0),
        purchaseDate: purchase.createdAt,
        expiryDate: purchase.expiresAt,
        isExpired,
        usagePercentage: Math.round(usagePercentage * 10) / 10
      };
    });

    // Apply search filter if provided
    let filteredUsageData = usageData;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsageData = usageData.filter(item => 
        item.userName.toLowerCase().includes(searchLower) ||
        item.userEmail.toLowerCase().includes(searchLower) ||
        item.packageName.toLowerCase().includes(searchLower)
      );
    }
 
    const stats = {
      totalPurchases: filteredUsageData.length,
      totalRevenue: filteredUsageData.reduce((sum, item) => sum + item.totalAmount, 0),
      totalActivePasses: filteredUsageData.reduce((sum, item) => sum + item.activePasses, 0),
      totalUsedPasses: filteredUsageData.reduce((sum, item) => sum + item.usedPasses, 0),
      averageUsageRate: filteredUsageData.length > 0 
        ? filteredUsageData.reduce((sum, item) => sum + item.usagePercentage, 0) / filteredUsageData.length 
        : 0
    };


    res.json({
      success: true,
      usage: filteredUsageData,
      stats: {
        ...stats,
        averageUsageRate: Math.round(stats.averageUsageRate * 10) / 10
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

exports.getUserPackageUsage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

   
    const { data: purchases, error: purchasesError } = await supabase
      .from('PackagePurchase')
      .select(`
        id,
        packageId,
        totalAmount,
        paymentStatus,
        activatedAt,
        expiresAt,
        createdAt,
        Package (
          id,
          name,
          packageType,
          targetRole,
          passCount
        ),
        UserPass (
          id,
          passtype,
          hours,
          status,
          usedat,
          bookingid
        )
      `)
      .eq('userId', userId)
      .eq('paymentStatus', 'COMPLETED')
      .eq('isActive', true)
      .order('createdAt', { ascending: false });

    if (purchasesError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user package purchases',
        details: purchasesError.message
      });
    }

    const userUsage = purchases.map(purchase => {
      let totalPasses = 0;
      let usedPasses = 0;
      let activePasses = 0;
      let expiredPasses = 0;
      
      if (purchase.UserPass && purchase.UserPass.length > 0) {
        purchase.UserPass.forEach(pass => {
          totalPasses += 1;
          if (pass.status === 'USED') {
            usedPasses += 1;
          } else if (pass.status === 'ACTIVE') {
            activePasses += 1;
          } else if (pass.status === 'EXPIRED') {
            expiredPasses += 1;
          }
        });
      } else {
        totalPasses = purchase.Package?.passCount || 0;
        activePasses = totalPasses; 
      }
      
      const isExpired = purchase.expiresAt ? new Date() > new Date(purchase.expiresAt) : false;
      const usagePercentage = totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0;

      return {
        purchaseId: purchase.id,
        packageName: purchase.Package?.name || 'Unknown Package',
        packageType: purchase.Package?.packageType || 'UNKNOWN',
        targetRole: purchase.Package?.targetRole || 'UNKNOWN',
        totalPasses,
        usedPasses,
        activePasses,
        expiredPasses,
        totalAmount: parseFloat(purchase.totalAmount || 0),
        purchaseDate: purchase.createdAt,
        expiryDate: purchase.expiresAt,
        isExpired,
        usagePercentage: Math.round(usagePercentage * 10) / 10
      };
    });

   
    const userStats = {
      totalPurchases: userUsage.length,
      totalSpent: userUsage.reduce((sum, item) => sum + item.totalAmount, 0),
      totalActivePasses: userUsage.reduce((sum, item) => sum + item.activePasses, 0),
      totalUsedPasses: userUsage.reduce((sum, item) => sum + item.usedPasses, 0),
      averageUsageRate: userUsage.length > 0 
        ? userUsage.reduce((sum, item) => sum + item.usagePercentage, 0) / userUsage.length 
        : 0
    };

    res.json({
      success: true,
      usage: userUsage,
      stats: {
        ...userStats,
        averageUsageRate: Math.round(userStats.averageUsageRate * 10) / 10
      }
    });

  } catch (error) {
    console.error('Error in getUserPackageUsage:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

exports.getPackageAnalytics = async (req, res) => {
  try {
   
    const { data: packages, error: packagesError } = await supabase
      .from('Package')
      .select(`
        id,
        name,
        packagetype,
        targetrole,
        price,
        originalprice,
        isactive,
        PackagePurchase (
          id,
          totalamount,
          paymentstatus,
          createdat,
          UserPass (
            id,
            status
          )
        )
      `)
      .eq('isactive', true)
      .order('createdat', { ascending: false });

    if (packagesError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch packages',
        details: packagesError.message
      });
    }

   
    const analytics = packages.map(pkg => {
      const purchases = pkg.PackagePurchase || [];
      const completedPurchases = purchases.filter(p => p.paymentstatus === 'COMPLETED');
      
      const totalPurchases = completedPurchases.length;
      const totalRevenue = completedPurchases.reduce((sum, p) => sum + parseFloat(p.totalamount || 0), 0);
      
      let totalPasses = 0;
      let usedPasses = 0;
      
      completedPurchases.forEach(purchase => {
        const passes = purchase.UserPass || [];
        totalPasses += passes.length;
        usedPasses += passes.filter(pass => pass.status === 'USED').length;
      });
      
      const usageRate = totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0;
      const averageRevenuePerPurchase = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

      return {
        packageId: pkg.id,
        packageName: pkg.name,
        packageType: pkg.packagetype,
        targetRole: pkg.targetrole,
        price: parseFloat(pkg.price || 0),
        originalPrice: parseFloat(pkg.originalprice || 0),
        totalPurchases,
        totalRevenue,
        averageRevenuePerPurchase: Math.round(averageRevenuePerPurchase * 100) / 100,
        totalPasses,
        usedPasses,
        usageRate: Math.round(usageRate * 10) / 10,
        discount: pkg.originalprice ? Math.round(((pkg.originalprice - pkg.price) / pkg.originalprice) * 100) : 0
      };
    });

    analytics.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Error in getPackageAnalytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

