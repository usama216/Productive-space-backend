const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { createAdminUser } = require('../controllers/adminUserController');

// Admin user management routes (authentication + admin required)
router.post('/admin/users/create-admin', authenticateUser, requireAdmin, createAdminUser);

module.exports = router;
