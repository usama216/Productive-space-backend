const express = require('express');
const router = express.Router();
const promoCodeController = require('../controllers/promoCodeController');

router.post('/apply', promoCodeController.applyPromoCode);
router.get('/user/:userId/available', promoCodeController.getUserAvailablePromos);
router.get('/user/:userId/used', promoCodeController.getUserUsedPromos);
router.post('/admin/create', promoCodeController.createPromoCode);
router.put('/admin/:id', promoCodeController.updatePromoCode);
router.delete('/admin/:id', promoCodeController.deletePromoCode);
router.delete('/admin/:id/force', promoCodeController.forceDeletePromoCode);
router.put('/admin/:id/restore', promoCodeController.restorePromoCode);
router.get('/admin/all', promoCodeController.getAllPromoCodes);
router.get('/admin/:id', promoCodeController.getPromoCodeById);

module.exports = router;