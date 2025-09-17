const express = require("express");
const router = express.Router();

const {
  createPackagePayment,
  handlePackageWebhook,
  getPackagePaymentStatus,
  manualCompletePayment,
  confirmPackagePayment
} = require("../controllers/packagePaymentController");

router.post("/payment", createPackagePayment);
router.post("/webhook", handlePackageWebhook);
router.get("/payment-status/:orderId", getPackagePaymentStatus);
router.post("/confirm", confirmPackagePayment);
router.post("/manual-complete", manualCompletePayment);

module.exports = router;

