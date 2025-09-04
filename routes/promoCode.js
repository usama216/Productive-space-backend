const express = require('express');
const router = express.Router();
const promoCodeController = require('../controllers/promoCodeController');

// ==================== USER/CLIENT ROUTES ====================

// Apply promo code during booking
router.post('/apply', promoCodeController.applyPromoCode);

// Get available promo codes for a user
router.get('/user/:userId/available', promoCodeController.getUserAvailablePromos);

// Get user's used promo codes
router.get('/user/:userId/used', promoCodeController.getUserUsedPromos);

// ==================== ADMIN ROUTES ====================

// Create new promo code
router.post('/admin/create', promoCodeController.createPromoCode);

// Update promo code
router.put('/admin/:id', promoCodeController.updatePromoCode);

// Delete promo code
router.delete('/admin/:id', promoCodeController.deletePromoCode);

// Force delete promo code (bypasses usage check)
router.delete('/admin/:id/force', promoCodeController.forceDeletePromoCode);

// Restore soft-deleted promo code
router.put('/admin/:id/restore', promoCodeController.restorePromoCode);

// Get all promo codes (admin)
router.get('/admin/all', promoCodeController.getAllPromoCodes);

// Get specific promo code details (admin)
router.get('/admin/:id', promoCodeController.getPromoCodeById);

module.exports = router;