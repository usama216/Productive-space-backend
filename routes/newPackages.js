const express = require("express");
const router = express.Router();

// Import new package controller functions
const {
  // Client APIs
  getPackagesByRole,
  getPackageById,
  purchasePackage,
  getUserPackages,
  
  // Admin APIs
  getAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getAllPackagePurchases
} = require("../controllers/newPackageController");

// ==================== CLIENT ROUTES ====================

/**
 * @swagger
 * /api/new-packages/role/{role}:
 *   get:
 *     summary: Get packages by role
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [MEMBER, TUTOR, STUDENT]
 *         description: User role
 *     responses:
 *       200:
 *         description: List of packages for the specified role
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Package'
 *       400:
 *         description: Invalid role
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
// GET /api/packages/role/:role - Get packages by role (MEMBER, TUTOR, STUDENT)
router.get("/role/:role", getPackagesByRole);

// GET /api/packages/:id - Get specific package by ID
router.get("/:id", getPackageById);

/**
 * @swagger
 * /api/new-packages/purchase:
 *   post:
 *     summary: Purchase a package
 *     tags: [Packages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - packageId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID purchasing the package
 *               packageId:
 *                 type: string
 *                 description: Package ID to purchase
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method
 *     responses:
 *       200:
 *         description: Package purchase initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 purchaseId:
 *                   type: string
 *                 paymentUrl:
 *                   type: string
 *       400:
 *         description: Bad request
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
// POST /api/packages/purchase - Purchase a package
router.post("/purchase", purchasePackage);

// GET /api/packages/user/:userId - Get user's package purchases
router.get("/user/:userId", getUserPackages);

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /api/new-packages/admin/all:
 *   get:
 *     summary: Get all packages with filters and pagination (Admin)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [MEMBER, TUTOR, STUDENT]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of all packages with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 packages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Package'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/packages/admin/all - Get all packages with filters and pagination
router.get("/admin/all", getAllPackages);

/**
 * @swagger
 * /api/new-packages/admin/create:
 *   post:
 *     summary: Create new package (Admin)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 description: Package name
 *               description:
 *                 type: string
 *                 description: Package description
 *               price:
 *                 type: number
 *                 format: float
 *                 description: Package price
 *               role:
 *                 type: string
 *                 enum: [MEMBER, TUTOR, STUDENT]
 *                 description: Target role
 *               duration:
 *                 type: integer
 *                 description: Package duration in days
 *               passes:
 *                 type: integer
 *                 description: Number of passes included
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Whether package is active
 *     responses:
 *       200:
 *         description: Package created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Bad request
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
// POST /api/packages/admin/create - Create new package
router.post("/admin/create", createPackage);

// PUT /api/packages/admin/:id - Update package
router.put("/admin/:id", updatePackage);

// DELETE /api/packages/admin/:id - Delete package
router.delete("/admin/:id", deletePackage);

// GET /api/packages/admin/purchases - Get all package purchases with filters
router.get("/admin/purchases", getAllPackagePurchases);

module.exports = router;
