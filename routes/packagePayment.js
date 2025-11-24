const express = require("express");
const router = express.Router();

const {
  createPackagePayment,
  handlePackageWebhook,
  getPackagePaymentStatus,
  manualCompletePayment,
  confirmPackagePayment
} = require("../controllers/packagePaymentController");
const { verifyHitPayWebhookMiddleware } = require("../utils/webhookVerification");

router.post("/payment", createPackagePayment);
// Apply webhook signature verification before processing webhook
router.post("/webhook", verifyHitPayWebhookMiddleware, handlePackageWebhook);
router.get("/payment-status/:orderId", getPackagePaymentStatus);
router.post("/confirm", confirmPackagePayment);
router.post("/manual-complete", manualCompletePayment);

module.exports = router;

