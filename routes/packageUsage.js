// Package Usage Routes for Admin Dashboard
const express = require('express');
const router = express.Router();
const packageUsageController = require('../controllers/packageUsageController');

// Get comprehensive package usage data for admin
router.get('/admin/usage', packageUsageController.getPackageUsageData);

// Get package usage for specific user
router.get('/user/:userId', packageUsageController.getUserPackageUsage);

// Get package performance analytics
router.get('/admin/analytics', packageUsageController.getPackageAnalytics);

module.exports = router;

