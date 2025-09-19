const express = require('express');
const router = express.Router();
const {
  getAllRefundRequests,
  approveRefund,
  rejectRefund,
  getAllUserCredits,
  getRefundStats
} = require('../controllers/adminRefundController');

// Admin routes (temporarily without auth for testing)
router.get('/refunds', getAllRefundRequests);
router.post('/refunds/:refundId/approve', approveRefund);
router.post('/refunds/:refundId/reject', rejectRefund);
router.get('/credits', getAllUserCredits);
router.get('/stats', getRefundStats);

module.exports = router;
