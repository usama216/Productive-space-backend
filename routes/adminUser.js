const express = require('express');
const router = express.Router();
const { createAdminUser } = require('../controllers/adminUserController');

// Admin user management routes
router.post('/admin/users/create-admin', createAdminUser);

module.exports = router;
