const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");
const {
  getAllRefundRequests,
  approveRefund,
  rejectRefund,
  getAllUserCredits,
  getRefundStats,
  updateUserCredits
} = require('../controllers/adminRefundController');

// Apply authentication and admin check to all routes
router.use(authenticateUser, requireAdmin);

router.get('/refunds', getAllRefundRequests);
router.post('/refunds/:refundId/approve', approveRefund);
router.post('/refunds/:refundId/reject', rejectRefund);
router.get('/credits', getAllUserCredits);
router.get('/stats', getRefundStats);
router.put('/credits/:userId', updateUserCredits);

module.exports = router;
