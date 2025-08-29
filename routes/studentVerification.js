const express = require('express');
const router = express.Router();
const { 
  checkStudentVerification, 
  checkMultipleStudentVerifications, 
  getStudentVerificationStats 
} = require('../controllers/studentVerificationController');

/**
 * @route POST /api/student/check-verification
 * @desc Check if an email is associated with a verified student account
 * @access Public
 */
router.post('/check-verification', checkStudentVerification);

/**
 * @route POST /api/student/check-multiple
 * @desc Check student verification status for multiple emails
 * @access Public
 */
router.post('/check-multiple', checkMultipleStudentVerifications);

/**
 * @route GET /api/student/stats
 * @desc Get student verification statistics
 * @access Public
 */
router.get('/stats', getStudentVerificationStats);

module.exports = router;
