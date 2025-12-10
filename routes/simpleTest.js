const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const simpleTestController = require('../controllers/simpleTestController');

// Test routes (admin only - should be disabled in production)
router.get('/test-db', authenticateUser, requireAdmin, simpleTestController.testDatabase);

module.exports = router;
