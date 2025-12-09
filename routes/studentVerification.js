const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { 
  checkStudentVerification, 
  checkMultipleStudentVerifications, 
  getStudentVerificationStats 
} = require('../controllers/studentVerificationController');

// User routes (authentication required)
router.post('/check-verification', authenticateUser, checkStudentVerification);
router.post('/check-multiple', authenticateUser, checkMultipleStudentVerifications);

// Admin routes (authentication + admin required)
router.get('/stats', authenticateUser, requireAdmin, getStudentVerificationStats);

module.exports = router;
