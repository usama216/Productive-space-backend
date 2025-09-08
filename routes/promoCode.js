const express = require('express');
const router = express.Router();
const promoCodeController = require('../controllers/promoCodeController');

// ==================== USER/CLIENT ROUTES ====================

/**
 * @swagger
 * /api/promocode/apply:
 *   post:
 *     summary: Apply promo code during booking
 *     tags: [Promo Codes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - userId
 *               - amount
 *             properties:
 *               code:
 *                 type: string
 *                 description: Promo code to apply
 *               userId:
 *                 type: string
 *                 description: User ID applying the code
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Original amount before discount
 *     responses:
 *       200:
 *         description: Promo code applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 discount:
 *                   type: number
 *                   description: Discount amount
 *                 finalAmount:
 *                   type: number
 *                   description: Final amount after discount
 *       400:
 *         description: Invalid promo code or conditions not met
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
// Apply promo code during booking
router.post('/apply', promoCodeController.applyPromoCode);

/**
 * @swagger
 * /api/promocode/user/{userId}/available:
 *   get:
 *     summary: Get available promo codes for a user
 *     tags: [Promo Codes]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of available promo codes for the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   code:
 *                     type: string
 *                   description:
 *                     type: string
 *                   discountType:
 *                     type: string
 *                   discountValue:
 *                     type: number
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get available promo codes for a user
router.get('/user/:userId/available', promoCodeController.getUserAvailablePromos);

/**
 * @swagger
 * /api/promocode/user/{userId}/used:
 *   get:
 *     summary: Get user's used promo codes
 *     tags: [Promo Codes]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of used promo codes by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   code:
 *                     type: string
 *                   usedAt:
 *                     type: string
 *                     format: date-time
 *                   discountAmount:
 *                     type: number
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get user's used promo codes
router.get('/user/:userId/used', promoCodeController.getUserUsedPromos);

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /api/promocode/admin/create:
 *   post:
 *     summary: Create new promo code (Admin)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - description
 *               - discountType
 *               - discountValue
 *             properties:
 *               code:
 *                 type: string
 *                 description: Promo code
 *               description:
 *                 type: string
 *                 description: Code description
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *                 description: Type of discount
 *               discountValue:
 *                 type: number
 *                 description: Discount value
 *               validFrom:
 *                 type: string
 *                 format: date
 *                 description: Valid from date
 *               validUntil:
 *                 type: string
 *                 format: date
 *                 description: Valid until date
 *               usageLimit:
 *                 type: integer
 *                 description: Maximum usage limit
 *     responses:
 *       200:
 *         description: Promo code created successfully
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
// Create new promo code
router.post('/admin/create', promoCodeController.createPromoCode);

/**
 * @swagger
 * /api/promocode/admin/{id}:
 *   put:
 *     summary: Update promo code (Admin)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Promo code ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *               discountValue:
 *                 type: number
 *               validFrom:
 *                 type: string
 *                 format: date
 *               validUntil:
 *                 type: string
 *                 format: date
 *               usageLimit:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Promo code updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Promo code not found
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
// Update promo code
router.put('/admin/:id', promoCodeController.updatePromoCode);

/**
 * @swagger
 * /api/promocode/admin/{id}:
 *   delete:
 *     summary: Delete promo code (Admin)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Promo code ID
 *     responses:
 *       200:
 *         description: Promo code deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Promo code not found
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
// Delete promo code
router.delete('/admin/:id', promoCodeController.deletePromoCode);

// Force delete promo code (bypasses usage check)
router.delete('/admin/:id/force', promoCodeController.forceDeletePromoCode);

// Restore soft-deleted promo code
router.put('/admin/:id/restore', promoCodeController.restorePromoCode);

/**
 * @swagger
 * /api/promocode/admin/all:
 *   get:
 *     summary: Get all promo codes (Admin)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of all promo codes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   code:
 *                     type: string
 *                   description:
 *                     type: string
 *                   discountType:
 *                     type: string
 *                   discountValue:
 *                     type: number
 *                   usageCount:
 *                     type: integer
 *                   isActive:
 *                     type: boolean
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all promo codes (admin)
router.get('/admin/all', promoCodeController.getAllPromoCodes);

// Get specific promo code details (admin)
router.get('/admin/:id', promoCodeController.getPromoCodeById);

module.exports = router;