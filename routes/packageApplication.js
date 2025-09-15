const express = require('express');
const router = express.Router();
const packageApplicationController = require('../controllers/packageApplicationController');

// Apply package to booking
router.post('/apply-package', packageApplicationController.applyPackageToBooking);

// Get user's available packages for booking
router.get('/user-packages/:userId/:userRole', packageApplicationController.getUserPackagesForBooking);

// Calculate package discount
router.post('/calculate-discount', packageApplicationController.calculatePackageDiscount);

module.exports = router;
