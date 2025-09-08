const express = require("express");
const router = express.Router();

// Import package controller functions
const {
  getPackages,
  getPackageById,
  purchasePackage,
  confirmPackagePurchase,
  getUserPackages,
  getUserPasses,
  usePass,
  getPurchaseHistory
} = require("../controllers/packageController");

// Import package purchase flow controller
const {
  initiatePackagePurchase,
  handlePackageWebhook,
  getPurchaseStatus
} = require("../controllers/packagePurchaseController");

// 🎯 Package Management Routes

/**
 * @swagger
 * /api/packages:
 *   get:
 *     summary: Get all available packages
 *     tags: [Packages]
 *     responses:
 *       200:
 *         description: List of all available packages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Package'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/packages - Get all available packages
router.get("/", getPackages);

/**
 * @swagger
 * /api/packages/{id}:
 *   get:
 *     summary: Get specific package by ID
 *     tags: [Packages]
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
 *               $ref: '#/components/schemas/Package'
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
// GET /api/packages/:id - Get specific package by ID
router.get("/:id", getPackageById);

// POST /api/packages/purchase - Create package purchase record (NO payment)
router.post("/purchase", purchasePackage);

// POST /api/packages/payment - Create payment for package (same as booking)
router.post("/payment", require("../controllers/packagePaymentController").createPackagePayment);

// POST /api/packages/confirm - Confirm package purchase after payment
router.post("/confirm", require("../controllers/packagePaymentController").confirmPackagePayment);

// 🎯 Package Purchase Flow Routes

// POST /api/packages/initiate - Complete package purchase flow
router.post("/initiate", initiatePackagePurchase);

// POST /api/packages/webhook - Handle payment webhooks
router.post("/webhook", handlePackageWebhook);

// GET /api/packages/status/:orderId - Get purchase status
router.get("/status/:orderId", getPurchaseStatus);

// 🎯 User Package Management Routes

// GET /api/packages/user/:userId/packages - Get user's active packages
router.get("/user/:userId/packages", getUserPackages);

// GET /api/packages/user/:userId/passes - Get user's available passes
router.get("/user/:userId/passes", getUserPasses);

// POST /api/packages/passes/use - Use a pass for booking
router.post("/passes/use", usePass);

// GET /api/packages/user/:userId/history - Get user's purchase history
router.get("/user/:userId/history", getPurchaseHistory);

module.exports = router;
