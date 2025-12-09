const express = require("express");
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");

const {
  createPackagePayment,
  handlePackageWebhook,
  getPackagePaymentStatus,
  manualCompletePayment,
  confirmPackagePayment
} = require("../controllers/packagePaymentController");
const { verifyHitPayWebhookMiddleware } = require("../utils/webhookVerification");

// User routes (authentication required)
router.post("/payment", authenticateUser, createPackagePayment);
router.get("/payment-status/:orderId", authenticateUser, getPackagePaymentStatus);
router.post("/confirm", authenticateUser, confirmPackagePayment);

// Admin routes (authentication + admin required)
router.post("/manual-complete", authenticateUser, requireAdmin, manualCompletePayment);

// Webhook route (no authentication - uses signature verification instead)
router.post("/webhook", verifyHitPayWebhookMiddleware, handlePackageWebhook);

module.exports = router;

