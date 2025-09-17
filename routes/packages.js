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

router.get("/", getPackages);
router.get("/:id", getPackageById);
router.post("/purchase", purchasePackage);
router.post("/initiate", initiatePackagePurchase);
router.post("/webhook", handlePackageWebhook);
router.get("/status/:orderId", getPurchaseStatus);
router.get("/user/:userId/packages", getUserPackages);
router.get("/user/:userId/passes", getUserPasses);
router.post("/passes/use", usePass);
router.get("/user/:userId/history", getPurchaseHistory);

module.exports = router;
