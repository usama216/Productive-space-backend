const express = require("express");
const router = express.Router();

const {
  getPackagesByRole,
  getPackageById,
  purchasePackage,
  getUserPackages,
  getUserPackageUsage,
  
  // Admin APIs
  getAllPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getAllPackagePurchases
} = require("../controllers/newPackageController");

router.get("/role/:role", getPackagesByRole);
router.get("/:id", getPackageById);
router.post("/purchase", purchasePackage);
router.get("/user/:userId", getUserPackages);
router.get("/usage/:userId", getUserPackageUsage);
router.get("/admin/all", getAllPackages);
router.post("/admin/create", createPackage);
router.put("/admin/:id", updatePackage);
router.delete("/admin/:id", deletePackage);
router.get("/admin/purchases", getAllPackagePurchases);

module.exports = router;
