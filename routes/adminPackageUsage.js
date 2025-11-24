const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");
const adminPackageUsageController = require('../controllers/adminPackageUsageController');

// Apply authentication and admin check to all routes
router.use(authenticateUser, requireAdmin);

router.get('/usage', adminPackageUsageController.getPackageUsageAnalytics);
router.get('/usage/:packageId', adminPackageUsageController.getPackageUsageDetails);

module.exports = router;
