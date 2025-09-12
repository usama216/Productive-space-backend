// Package Usage Controller for Admin Dashboard
const { createClient } = require('@supabase/supabase-js');

/**
 * @swagger
 * components:
 *   schemas:
 *     PackageUsageData:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Package purchase ID
 *         userId:
 *           type: string
 *           description: User ID who purchased the package
 *         userName:
 *           type: string
 *           description: User's full name
 *         userEmail:
 *           type: string
 *           description: User's email address
 *         packageName:
 *           type: string
 *           description: Name of the package
 *         packageType:
 *           type: string
 *           enum: [HALF_DAY, FULL_DAY, SEMESTER_BUNDLE]
 *           description: Type of package
 *         targetRole:
 *           type: string
 *           enum: [MEMBER, STUDENT, TUTOR]
 *           description: Target role for the package
 *         totalPasses:
 *           type: integer
 *           description: Total number of passes in the package
 *         usedPasses:
 *           type: integer
 *           description: Number of passes used
 *         activePasses:
 *           type: integer
 *           description: Number of active passes remaining
 *         expiredPasses:
 *           type: integer
 *           description: Number of expired passes
 *         totalAmount:
 *           type: number
 *           description: Total amount paid for the package
 *         purchaseDate:
 *           type: string
 *           format: date-time
 *           description: Date when package was purchased
 *         expiryDate:
 *           type: string
 *           format: date-time
 *           description: Date when package expires
 *         isExpired:
 *           type: boolean
 *           description: Whether the package has expired
 *         usagePercentage:
 *           type: number
 *           description: Percentage of passes used
 *     
 *     PackageStats:
 *       type: object
 *       properties:
 *         totalPurchases:
 *           type: integer
 *           description: Total number of package purchases
 *         totalRevenue:
 *           type: number
 *           description: Total revenue from packages
 *         totalActivePasses:
 *           type: integer
 *           description: Total number of active passes
 *         totalUsedPasses:
 *           type: integer
 *           description: Total number of used passes
 *         averageUsageRate:
 *           type: number
 *           description: Average usage rate across all packages
 *     
 *     PackageAnalytics:
 *       type: object
 *       properties:
 *         packageId:
 *           type: string
 *           description: Package ID
 *         packageName:
 *           type: string
 *           description: Package name
 *         packageType:
 *           type: string
 *           enum: [HALF_DAY, FULL_DAY, SEMESTER_BUNDLE]
 *           description: Package type
 *         targetRole:
 *           type: string
 *           enum: [MEMBER, STUDENT, TUTOR]
 *           description: Target role
 *         price:
 *           type: number
 *           description: Current price
 *         originalPrice:
 *           type: number
 *           description: Original price before discount
 *         totalPurchases:
 *           type: integer
 *           description: Total number of purchases
 *         totalRevenue:
 *           type: number
 *           description: Total revenue from this package
 *         averageRevenuePerPurchase:
 *           type: number
 *           description: Average revenue per purchase
 *         totalPasses:
 *           type: integer
 *           description: Total passes across all purchases
 *         usedPasses:
 *           type: integer
 *           description: Total used passes
 *         usageRate:
 *           type: number
 *           description: Usage rate percentage
 *         discount:
 *           type: integer
 *           description: Discount percentage
 */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * @swagger
 * /api/packages/admin/usage:
 *   get:
 *     summary: Get comprehensive package usage data for admin
 *     description: Retrieves detailed package usage information across all users for admin dashboard
 *     tags: [Package Usage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Package usage data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 usage:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PackageUsageData'
 *                 stats:
 *                   $ref: '#/components/schemas/PackageStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
// Get comprehensive package usage data for admin
exports.getPackageUsageData = async (req, res) => {
  try {
    console.log('📊 Fetching package usage data for admin...');

    // Get all package purchases with related data
    const { data: purchases, error: purchasesError } = await supabase
      .from('PackagePurchase')
      .select(`
        id,
        userid,
        packageid,
        totalamount,
        paymentstatus,
        activatedat,
        expiresat,
        createdat,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents
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
      .eq('paymentstatus', 'COMPLETED')
      .eq('isactive', true)
      .order('createdat', { ascending: false });

    if (purchasesError) {
      console.error('Error fetching package purchases:', purchasesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch package purchases',
        details: purchasesError.message
      });
    }

    // Process the data to create usage summary
    const usageData = purchases.map(purchase => {
      const totalPasses = purchase.UserPass.length;
      const usedPasses = purchase.UserPass.filter(pass => pass.status === 'USED').length;
      const activePasses = purchase.UserPass.filter(pass => pass.status === 'ACTIVE').length;
      const expiredPasses = purchase.UserPass.filter(pass => pass.status === 'EXPIRED').length;
      
      const isExpired = purchase.expiresat ? new Date() > new Date(purchase.expiresat) : false;
      const usagePercentage = totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0;

      return {
        id: purchase.id,
        userId: purchase.userid,
        userName: `${purchase.User?.firstName || ''} ${purchase.User?.lastName || ''}`.trim() || purchase.User?.email?.split('@')[0] || 'Unknown',
        userEmail: purchase.User?.email || 'Unknown',
        packageName: purchase.Package?.name || 'Unknown Package',
        packageType: purchase.Package?.packagetype || 'UNKNOWN',
        targetRole: purchase.Package?.targetrole || 'UNKNOWN',
        totalPasses,
        usedPasses,
        activePasses,
        expiredPasses,
        totalAmount: parseFloat(purchase.totalamount || 0),
        purchaseDate: purchase.createdat,
        expiryDate: purchase.expiresat,
        isExpired,
        usagePercentage: Math.round(usagePercentage * 10) / 10 // Round to 1 decimal place
      };
    });

    // Calculate statistics
    const stats = {
      totalPurchases: usageData.length,
      totalRevenue: usageData.reduce((sum, item) => sum + item.totalAmount, 0),
      totalActivePasses: usageData.reduce((sum, item) => sum + item.activePasses, 0),
      totalUsedPasses: usageData.reduce((sum, item) => sum + item.usedPasses, 0),
      averageUsageRate: usageData.length > 0 
        ? usageData.reduce((sum, item) => sum + item.usagePercentage, 0) / usageData.length 
        : 0
    };

    console.log(`✅ Package usage data fetched: ${usageData.length} purchases, $${stats.totalRevenue.toFixed(2)} revenue`);

    res.json({
      success: true,
      usage: usageData,
      stats: {
        ...stats,
        averageUsageRate: Math.round(stats.averageUsageRate * 10) / 10
      }
    });

  } catch (error) {
    console.error('Error in getPackageUsageData:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * @swagger
 * /api/packages/user/{userId}:
 *   get:
 *     summary: Get package usage for specific user
 *     description: Retrieves package usage information for a specific user
 *     tags: [Package Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User package usage data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 usage:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PackageUsageData'
 *                 stats:
 *                   $ref: '#/components/schemas/PackageStats'
 *       400:
 *         description: Bad request - User ID is required
 *       500:
 *         description: Internal server error
 */
// Get package usage summary by user
exports.getUserPackageUsage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log(`📊 Fetching package usage for user: ${userId}`);

    // Get user's package purchases
    const { data: purchases, error: purchasesError } = await supabase
      .from('PackagePurchase')
      .select(`
        id,
        packageid,
        totalamount,
        paymentstatus,
        activatedat,
        expiresat,
        createdat,
        Package (
          id,
          name,
          packagetype,
          targetrole
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
      .eq('userid', userId)
      .eq('paymentstatus', 'COMPLETED')
      .eq('isactive', true)
      .order('createdat', { ascending: false });

    if (purchasesError) {
      console.error('Error fetching user package purchases:', purchasesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user package purchases',
        details: purchasesError.message
      });
    }

    // Process user's package usage
    const userUsage = purchases.map(purchase => {
      const totalPasses = purchase.UserPass.length;
      const usedPasses = purchase.UserPass.filter(pass => pass.status === 'USED').length;
      const activePasses = purchase.UserPass.filter(pass => pass.status === 'ACTIVE').length;
      const expiredPasses = purchase.UserPass.filter(pass => pass.status === 'EXPIRED').length;
      
      const isExpired = purchase.expiresat ? new Date() > new Date(purchase.expiresat) : false;
      const usagePercentage = totalPasses > 0 ? (usedPasses / totalPasses) * 100 : 0;

      return {
        purchaseId: purchase.id,
        packageName: purchase.Package?.name || 'Unknown Package',
        packageType: purchase.Package?.packagetype || 'UNKNOWN',
        targetRole: purchase.Package?.targetrole || 'UNKNOWN',
        totalPasses,
        usedPasses,
        activePasses,
        expiredPasses,
        totalAmount: parseFloat(purchase.totalamount || 0),
        purchaseDate: purchase.createdat,
        expiryDate: purchase.expiresat,
        isExpired,
        usagePercentage: Math.round(usagePercentage * 10) / 10
      };
    });

    // Calculate user statistics
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

/**
 * @swagger
 * /api/packages/admin/analytics:
 *   get:
 *     summary: Get package performance analytics
 *     description: Retrieves analytics data for all packages including revenue, usage rates, and performance metrics
 *     tags: [Package Usage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Package analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 analytics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PackageAnalytics'
 *       500:
 *         description: Internal server error
 */
// Get package performance analytics
exports.getPackageAnalytics = async (req, res) => {
  try {
    console.log('📈 Fetching package analytics...');

    // Get all packages with their purchase data
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
      console.error('Error fetching packages:', packagesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch packages',
        details: packagesError.message
      });
    }

    // Process package analytics
    const analytics = packages.map(pkg => {
      const purchases = pkg.PackagePurchase || [];
      const completedPurchases = purchases.filter(p => p.paymentstatus === 'COMPLETED');
      
      const totalPurchases = completedPurchases.length;
      const totalRevenue = completedPurchases.reduce((sum, p) => sum + parseFloat(p.totalamount || 0), 0);
      
      // Calculate pass usage across all purchases
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

    // Sort by total revenue
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

