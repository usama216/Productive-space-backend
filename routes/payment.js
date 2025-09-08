

const express=require("express")
const { createPayment, handleWebhook }=require("../controllers/payment")

const router = express.Router();

/**
 * @swagger
 * /api/hitpay/create-payment:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - currency
 *               - referenceId
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Payment amount
 *               currency:
 *                 type: string
 *                 default: SGD
 *                 description: Payment currency
 *               referenceId:
 *                 type: string
 *                 description: Unique reference ID for the payment
 *               description:
 *                 type: string
 *                 description: Payment description
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
 *                 paymentUrl:
 *                   type: string
 *                   description: URL to redirect user for payment
 *                 paymentId:
 *                   type: string
 *                   description: Payment ID
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
router.post("/create-payment", createPayment);

/**
 * @swagger
 * /api/hitpay/webhook:
 *   post:
 *     summary: Handle payment webhook notifications
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reference:
 *                 type: string
 *                 description: Payment reference ID
 *               status:
 *                 type: string
 *                 enum: [completed, failed, pending]
 *                 description: Payment status
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *     responses:
 *       200:
 *         description: Webhook processed successfully
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
router.post("/webhook", handleWebhook);

module.exports= router;
