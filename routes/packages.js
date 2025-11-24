const express = require("express");
const router = express.Router();

const {
  getPackages,
  getPackageById,
  purchasePackage,
  confirmPackagePurchase,
  getUserPackages,
  getUserPasses,
  usePass,
  getPurchaseHistory
} = require("../controllers/packageController");

const {
  initiatePackagePurchase,
  handlePackageWebhook,
  getPurchaseStatus
} = require("../controllers/packagePurchaseController");
const { verifyHitPayWebhookMiddleware } = require("../utils/webhookVerification");

router.get("/", getPackages);
router.get("/:id", getPackageById);
router.post("/purchase", purchasePackage);
router.post("/initiate", initiatePackagePurchase);
// Apply webhook signature verification before processing webhook
router.post("/webhook", verifyHitPayWebhookMiddleware, handlePackageWebhook);
router.get("/status/:orderId", getPurchaseStatus);
router.get("/user/:userId/packages", getUserPackages);
router.get("/user/:userId/passes", getUserPasses);
router.post("/passes/use", usePass);
router.get("/user/:userId/history", getPurchaseHistory);

module.exports = router;
