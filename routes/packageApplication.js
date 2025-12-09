const express = require('express');
const router = express.Router();
const { authenticateUser, requireOwnershipOrAdmin } = require('../middleware/auth');
const packageApplicationController = require('../controllers/packageApplicationController');

// User routes (authentication required)
router.post('/apply-package', authenticateUser, packageApplicationController.applyPackageToBooking);
router.get('/user-packages/:userId/:userRole', authenticateUser, requireOwnershipOrAdmin('userId'), packageApplicationController.getUserPackagesForBooking);
router.post('/calculate-discount', authenticateUser, packageApplicationController.calculatePackageDiscount);

module.exports = router;
