const express = require("express");
const router = express.Router();

// Import package controller functions
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

// Import package purchase flow controller
const {
  initiatePackagePurchase,
  handlePackageWebhook,
  getPurchaseStatus
} = require("../controllers/packagePurchaseController");

// 🎯 Package Management Routes

// GET /api/packages - Get all available packages
router.get("/", getPackages);

// GET /api/packages/:id - Get specific package by ID
router.get("/:id", getPackageById);

// POST /api/packages/purchase - Create package purchase record (NO payment)
router.post("/purchase", purchasePackage);

// POST /api/packages/payment - Create payment for package (same as booking)
router.post("/payment", require("../controllers/packageController").createPackagePaymentRequest);

// POST /api/packages/confirm - Confirm package purchase after payment
router.post("/confirm", confirmPackagePurchase);

// 🎯 Package Purchase Flow Routes

// POST /api/packages/initiate - Complete package purchase flow
router.post("/initiate", initiatePackagePurchase);

// POST /api/packages/webhook - Handle payment webhooks
router.post("/webhook", handlePackageWebhook);

// GET /api/packages/status/:orderId - Get purchase status
router.get("/status/:orderId", getPurchaseStatus);

// 🎯 User Package Management Routes

// GET /api/packages/user/:userId/packages - Get user's active packages
router.get("/user/:userId/packages", getUserPackages);

// GET /api/packages/user/:userId/passes - Get user's available passes
router.get("/user/:userId/passes", getUserPasses);

// POST /api/packages/passes/use - Use a pass for booking
router.post("/passes/use", usePass);

// GET /api/packages/user/:userId/history - Get user's purchase history
router.get("/user/:userId/history", getPurchaseHistory);

module.exports = router;
