const express = require('express');
const router = express.Router();
const { 
  checkStudentVerification, 
  checkMultipleStudentVerifications, 
  getStudentVerificationStats 
} = require('../controllers/studentVerificationController');


router.post('/check-verification', checkStudentVerification);
router.post('/check-multiple', checkMultipleStudentVerifications);
router.get('/stats', getStudentVerificationStats);

module.exports = router;
