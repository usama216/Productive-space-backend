const express = require("express");
const { authenticateUser, requireOwnershipOrAdmin } = require("../middleware/auth");
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

// Public routes (no authentication required)
router.get("/", getPackages);
router.get("/:id", getPackageById);

// User routes (authentication required)
router.post("/purchase", authenticateUser, purchasePackage);
router.post("/initiate", authenticateUser, initiatePackagePurchase);
router.get("/status/:orderId", authenticateUser, getPurchaseStatus);
router.get("/user/:userId/packages", authenticateUser, requireOwnershipOrAdmin('userId'), getUserPackages);
router.get("/user/:userId/passes", authenticateUser, requireOwnershipOrAdmin('userId'), getUserPasses);
router.post("/passes/use", authenticateUser, usePass);
router.get("/user/:userId/history", authenticateUser, requireOwnershipOrAdmin('userId'), getPurchaseHistory);

// Webhook route (no authentication - uses signature verification instead)
router.post("/webhook", verifyHitPayWebhookMiddleware, handlePackageWebhook);

module.exports = router;
