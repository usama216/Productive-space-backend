
const express = require("express");
const { authenticateUser } = require("../middleware/auth");
const { createPayment, handleWebhook } = require("../controllers/payment");
const { verifyHitPayWebhookMiddleware } = require("../utils/webhookVerification");

const router = express.Router();

// User routes (authentication required)
router.post("/create-payment", authenticateUser, createPayment);

// Webhook route (no authentication - uses signature verification instead)
router.post("/webhook", verifyHitPayWebhookMiddleware, handleWebhook);

module.exports = router;
