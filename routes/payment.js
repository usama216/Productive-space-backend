

const express=require("express")
const { createPayment, handleWebhook }=require("../controllers/payment")
const { verifyHitPayWebhookMiddleware } = require("../utils/webhookVerification")

const router = express.Router();
router.post("/create-payment", createPayment);
// Apply webhook signature verification before processing webhook
router.post("/webhook", verifyHitPayWebhookMiddleware, handleWebhook);

module.exports= router;
