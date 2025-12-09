const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
const promoCodeController = require('../controllers/promoCodeController');

// User routes (authentication required)
router.post('/apply', authenticateUser, promoCodeController.applyPromoCode);
router.get('/user/:userId/available', authenticateUser, requireOwnershipOrAdmin('userId'), promoCodeController.getUserAvailablePromos);
router.get('/user/:userId/used', authenticateUser, requireOwnershipOrAdmin('userId'), promoCodeController.getUserUsedPromos);

// Admin routes (authentication + admin required)
router.post('/admin/create', authenticateUser, requireAdmin, promoCodeController.createPromoCode);
router.put('/admin/:id', authenticateUser, requireAdmin, promoCodeController.updatePromoCode);
router.delete('/admin/:id', authenticateUser, requireAdmin, promoCodeController.deletePromoCode);
router.delete('/admin/:id/force', authenticateUser, requireAdmin, promoCodeController.forceDeletePromoCode);
router.put('/admin/:id/restore', authenticateUser, requireAdmin, promoCodeController.restorePromoCode);
router.get('/admin/all', authenticateUser, requireAdmin, promoCodeController.getAllPromoCodes);
router.get('/admin/:id', authenticateUser, requireAdmin, promoCodeController.getPromoCodeById);

module.exports = router;