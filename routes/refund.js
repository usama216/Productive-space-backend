const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const {
  requestRefund,
  getUserRefundRequests,
  getUserCredits,
  getUserCreditUsage
} = require('../controllers/refundController');

// User routes (authentication required)
router.post('/request', authenticateUser, requestRefund);
router.get('/requests', authenticateUser, getUserRefundRequests);
router.get('/credits', authenticateUser, getUserCredits);
router.get('/credit-usage', authenticateUser, getUserCreditUsage);

module.exports = router;
