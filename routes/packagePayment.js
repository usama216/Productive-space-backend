const express = require("express");
const router = express.Router();

// Import package payment controller functions
const {
  createPackagePayment,
  handlePackageWebhook,
  getPackagePaymentStatus,
  manualCompletePayment,
  confirmPackagePayment
} = require("../controllers/packagePaymentController");

// ==================== PACKAGE PAYMENT ROUTES ====================

/**
 * @swagger
 * /api/packages/payment:
 *   post:
 *     summary: Create payment for package purchase
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purchaseId
 *               - amount
 *             properties:
 *               purchaseId:
 *                 type: string
 *                 description: Package purchase ID
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Payment amount
 *               currency:
 *                 type: string
 *                 default: SGD
 *                 description: Payment currency
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method
 *     responses:
 *       200:
 *         description: Payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 paymentId:
 *                   type: string
 *                 paymentUrl:
 *                   type: string
 *                 referenceId:
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
// POST /api/packages/payment - Create payment for package purchase
router.post("/payment", createPackagePayment);

// POST /api/packages/webhook - Handle package payment webhook
router.post("/webhook", handlePackageWebhook);

/**
 * @swagger
 * /api/packages/payment-status/{orderId}:
 *   get:
 *     summary: Get package payment status
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [PENDING, PAID, FAILED, REFUNDED]
 *                 amount:
 *                   type: number
 *                 paymentMethod:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Order not found
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
// GET /api/packages/payment-status/:orderId - Get payment status
router.get("/payment-status/:orderId", getPackagePaymentStatus);

// POST /api/packages/confirm - Confirm package payment (for frontend redirect)
router.post("/confirm", confirmPackagePayment);

// POST /api/packages/manual-complete - Manually complete payment (for webhook issues)
router.post("/manual-complete", manualCompletePayment);

module.exports = router;

