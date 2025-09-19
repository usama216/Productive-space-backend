const express = require('express');
const router = express.Router();
const {
  requestRefund,
  getUserRefundRequests,
  getUserCredits,
  getUserCreditUsage
} = require('../controllers/refundController');

// User routes (temporarily without auth for testing)
router.post('/request', requestRefund);
router.get('/requests', getUserRefundRequests);
router.get('/credits', getUserCredits);
router.get('/credit-usage', getUserCreditUsage);

module.exports = router;
