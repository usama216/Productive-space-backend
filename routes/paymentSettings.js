const express = require('express');
const router = express.Router();
const {
  getAllPaymentSettings,
  getPaymentSetting,
  updatePaymentSetting,
  updateMultiplePaymentSettings,
  calculateTransactionFee
} = require('../controllers/paymentSettingsController');

/**
 * @swagger
 * /payment-settings:
 *   get:
 *     summary: Get all payment settings
 *     description: Retrieve all active payment configuration settings
 *     tags: [Payment Settings]
 *     responses:
 *       200:
 *         description: Successfully retrieved payment settings
 *       500:
 *         description: Server error
 */
router.get('/', getAllPaymentSettings);

/**
 * @swagger
 * /payment-settings/{key}:
 *   get:
 *     summary: Get a single payment setting by key
 *     description: Retrieve a specific payment setting by its key
 *     tags: [Payment Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The setting key (e.g., PAYNOW_TRANSACTION_FEE)
 *     responses:
 *       200:
 *         description: Successfully retrieved setting
 *       404:
 *         description: Setting not found
 *       500:
 *         description: Server error
 */
router.get('/:key', getPaymentSetting);

/**
 * @swagger
 * /payment-settings/{key}:
 *   put:
 *     summary: Update a payment setting
 *     description: Update a specific payment setting by its key
 *     tags: [Payment Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The setting key (e.g., PAYNOW_TRANSACTION_FEE)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settingValue:
 *                 type: string
 *                 description: The new value for the setting
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.put('/:key', updatePaymentSetting);

/**
 * @swagger
 * /payment-settings/bulk-update:
 *   post:
 *     summary: Update multiple payment settings
 *     description: Update multiple payment settings at once
 *     tags: [Payment Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     settingKey:
 *                       type: string
 *                     settingValue:
 *                       type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/bulk-update', updateMultiplePaymentSettings);

/**
 * @swagger
 * /payment-settings/calculate-fee:
 *   post:
 *     summary: Calculate transaction fee
 *     description: Calculate transaction fee based on amount and payment method
 *     tags: [Payment Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Base amount
 *               paymentMethod:
 *                 type: string
 *                 enum: [paynow, credit_card]
 *                 description: Payment method
 *     responses:
 *       200:
 *         description: Fee calculated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/calculate-fee', calculateTransactionFee);

module.exports = router;

