const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
const packageUsageController = require('../controllers/packageUsageController');

// Admin routes (authentication + admin required)
router.get('/admin/usage', authenticateUser, requireAdmin, packageUsageController.getPackageUsageData);
router.get('/admin/analytics', authenticateUser, requireAdmin, packageUsageController.getPackageAnalytics);

// User routes (authentication required)
router.get('/user/:userId', authenticateUser, requireOwnershipOrAdmin('userId'), packageUsageController.getUserPackageUsage);

module.exports = router;

