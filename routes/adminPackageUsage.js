const express = require('express');
const router = express.Router();
const adminPackageUsageController = require('../controllers/adminPackageUsageController');

/**
 * @swagger
 * /api/admin/packages/usage:
 *   get:
 *     summary: Get package usage analytics for admin dashboard
 *     tags: [Admin - Package Usage]
 *     responses:
 *       200:
 *         description: Package usage analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 packages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       packageName:
 *                         type: string
 *                       packageType:
 *                         type: string
 *                       targetRole:
 *                         type: string
 *                       totalPurchases:
 *                         type: number
 *                       totalPasses:
 *                         type: number
 *                       usedPasses:
 *                         type: number
 *                       remainingPasses:
 *                         type: number
 *                       usagePercentage:
 *                         type: number
 *                       revenue:
 *                         type: number
 *                       lastUsed:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalPackages:
 *                       type: number
 *                     totalPurchases:
 *                       type: number
 *                     totalPasses:
 *                       type: number
 *                     totalUsed:
 *                       type: number
 *                     totalRevenue:
 *                       type: number
 *                     averageUsage:
 *                       type: number
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/usage', adminPackageUsageController.getPackageUsageAnalytics);

/**
 * @swagger
 * /api/admin/packages/usage/{packageId}:
 *   get:
 *     summary: Get detailed usage information for a specific package
 *     tags: [Admin - Package Usage]
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     responses:
 *       200:
 *         description: Package usage details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 package:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     packageType:
 *                       type: string
 *                     targetRole:
 *                       type: string
 *                     price:
 *                       type: number
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                 usageDetails:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       purchaseId:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *                           name:
 *                             type: string
 *                           memberType:
 *                             type: string
 *                       purchaseDetails:
 *                         type: object
 *                         properties:
 *                           quantity:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                           paymentMethod:
 *                             type: string
 *                           purchasedAt:
 *                             type: string
 *                           activatedAt:
 *                             type: string
 *                           expiresAt:
 *                             type: string
 *                       usage:
 *                         type: object
 *                         properties:
 *                           totalPasses:
 *                             type: number
 *                           usedPasses:
 *                             type: number
 *                           remainingPasses:
 *                             type: number
 *                           usagePercentage:
 *                             type: number
 *                       passDetails:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             totalCount:
 *                               type: number
 *                             remainingCount:
 *                               type: number
 *                             status:
 *                               type: string
 *                             usedAt:
 *                               type: string
 *                             bookingId:
 *                               type: string
 *                             locationId:
 *                               type: string
 *                             startTime:
 *                               type: string
 *                             endTime:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalPurchases:
 *                       type: number
 *                     totalPasses:
 *                       type: number
 *                     totalUsed:
 *                       type: number
 *                     totalRevenue:
 *                       type: number
 *                     averageUsage:
 *                       type: number
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/usage/:packageId', adminPackageUsageController.getPackageUsageDetails);

module.exports = router;
