const express = require("express");
const router = express.Router();

// Import admin package controller functions
const {
  getPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  getPackageStats
} = require("../controllers/adminPackageController");

// 🎯 Admin Package Management Routes

/**
 * @swagger
 * /api/admin/packages:
 *   get:
 *     summary: Get all packages for admin
 *     tags: [Admin Packages]
 *     responses:
 *       200:
 *         description: List of all packages
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
 *                     $ref: '#/components/schemas/Package'
 *       500:
 *         description: Server error
 */
router.get("/", getPackages);

/**
 * @swagger
 * /api/admin/packages/stats:
 *   get:
 *     summary: Get package statistics
 *     tags: [Admin Packages]
 *     responses:
 *       200:
 *         description: Package statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalPackages:
 *                       type: integer
 *                     activePackages:
 *                       type: integer
 *                     inactivePackages:
 *                       type: integer
 *                     totalPurchases:
 *                       type: integer
 *                     typeDistribution:
 *                       type: object
 *       500:
 *         description: Server error
 */
router.get("/stats", getPackageStats);

/**
 * @swagger
 * /api/admin/packages/{id}:
 *   get:
 *     summary: Get specific package by ID for admin
 *     tags: [Admin Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     responses:
 *       200:
 *         description: Package details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 package:
 *                   $ref: '#/components/schemas/Package'
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.get("/:id", getPackageById);

/**
 * @swagger
 * /api/admin/packages:
 *   post:
 *     summary: Create new package
 *     tags: [Admin Packages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - packageType
 *               - targetRole
 *               - price
 *               - passCount
 *             properties:
 *               name:
 *                 type: string
 *                 description: Package name
 *               description:
 *                 type: string
 *                 description: Package description
 *               packageType:
 *                 type: string
 *                 enum: [HALF_DAY, FULL_DAY, SEMESTER_BUNDLE]
 *                 description: Package type
 *               targetRole:
 *                 type: string
 *                 enum: [MEMBER, TUTOR, STUDENT]
 *                 description: Target user role
 *               price:
 *                 type: number
 *                 description: Package price
 *               originalPrice:
 *                 type: number
 *                 description: Original price (for discounts)
 *               outletFee:
 *                 type: number
 *                 description: Outlet fee
 *               passCount:
 *                 type: integer
 *                 description: Number of passes in package
 *               validityDays:
 *                 type: integer
 *                 description: Validity period in days
 *               isActive:
 *                 type: boolean
 *                 description: Whether package is active
 *     responses:
 *       201:
 *         description: Package created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 package:
 *                   $ref: '#/components/schemas/Package'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post("/", createPackage);

/**
 * @swagger
 * /api/admin/packages/{id}:
 *   put:
 *     summary: Update package
 *     tags: [Admin Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - packageType
 *               - targetRole
 *               - price
 *               - passCount
 *             properties:
 *               name:
 *                 type: string
 *                 description: Package name
 *               description:
 *                 type: string
 *                 description: Package description
 *               packageType:
 *                 type: string
 *                 enum: [HALF_DAY, FULL_DAY, SEMESTER_BUNDLE]
 *                 description: Package type
 *               targetRole:
 *                 type: string
 *                 enum: [MEMBER, TUTOR, STUDENT]
 *                 description: Target user role
 *               price:
 *                 type: number
 *                 description: Package price
 *               originalPrice:
 *                 type: number
 *                 description: Original price (for discounts)
 *               outletFee:
 *                 type: number
 *                 description: Outlet fee
 *               passCount:
 *                 type: integer
 *                 description: Number of passes in package
 *               validityDays:
 *                 type: integer
 *                 description: Validity period in days
 *               isActive:
 *                 type: boolean
 *                 description: Whether package is active
 *     responses:
 *       200:
 *         description: Package updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 package:
 *                   $ref: '#/components/schemas/Package'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.put("/:id", updatePackage);

/**
 * @swagger
 * /api/admin/packages/{id}:
 *   delete:
 *     summary: Delete package
 *     tags: [Admin Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     responses:
 *       200:
 *         description: Package deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", deletePackage);

/**
 * @swagger
 * /api/admin/packages/{id}/toggle-status:
 *   patch:
 *     summary: Toggle package active status
 *     tags: [Admin Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: New active status
 *     responses:
 *       200:
 *         description: Package status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 package:
 *                   $ref: '#/components/schemas/Package'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Package not found
 *       500:
 *         description: Server error
 */
router.patch("/:id/toggle-status", togglePackageStatus);

module.exports = router;
