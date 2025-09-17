const express = require('express');
const router = express.Router();
const packageUsageController = require('../controllers/packageUsageController');

router.get('/admin/usage', packageUsageController.getPackageUsageData);
router.get('/user/:userId', packageUsageController.getUserPackageUsage);
router.get('/admin/analytics', packageUsageController.getPackageAnalytics);

module.exports = router;

