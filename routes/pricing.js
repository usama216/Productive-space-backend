const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");
const {
  getAllPricingConfigurations,
  getPricingByLocationAndMemberType,
  getAllPricingForLocation,
  upsertPricingConfiguration,
  deletePricingConfiguration,
  getPricingConfigurationById
} = require('../controllers/pricingController');

// Admin routes for pricing management - require authentication and admin access
router.get('/admin/pricing', authenticateUser, requireAdmin, getAllPricingConfigurations);
router.get('/admin/pricing/:id', authenticateUser, requireAdmin, getPricingConfigurationById);
router.post('/admin/pricing', authenticateUser, requireAdmin, upsertPricingConfiguration);
router.delete('/admin/pricing/:id', authenticateUser, requireAdmin, deletePricingConfiguration);

// Public routes for fetching pricing (used by booking page)
router.get('/pricing/:location', getAllPricingForLocation);
router.get('/pricing/:location/:memberType', getPricingByLocationAndMemberType);
router.get('/pricing', getAllPricingConfigurations);

module.exports = router;
