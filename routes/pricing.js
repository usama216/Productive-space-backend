const express = require('express');
const router = express.Router();
const {
  getAllPricingConfigurations,
  getPricingByLocationAndMemberType,
  getAllPricingForLocation,
  upsertPricingConfiguration,
  deletePricingConfiguration,
  getPricingConfigurationById
} = require('../controllers/pricingController');

// Admin routes for pricing management
router.get('/admin/pricing', getAllPricingConfigurations);
router.get('/admin/pricing/:id', getPricingConfigurationById);
router.post('/admin/pricing', upsertPricingConfiguration);
router.delete('/admin/pricing/:id', deletePricingConfiguration);

// Public routes for fetching pricing (used by booking page)
router.get('/pricing/:location', getAllPricingForLocation);
router.get('/pricing/:location/:memberType', getPricingByLocationAndMemberType);
router.get('/pricing', getAllPricingConfigurations);

module.exports = router;
