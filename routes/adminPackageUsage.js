const express = require('express');
const router = express.Router();
const adminPackageUsageController = require('../controllers/adminPackageUsageController');

router.get('/usage', adminPackageUsageController.getPackageUsageAnalytics);
router.get('/usage/:packageId', adminPackageUsageController.getPackageUsageDetails);

module.exports = router;
