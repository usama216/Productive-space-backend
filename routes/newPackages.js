const express = require("express");
const router = express.Router();
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require("../middleware/auth");

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

// Public routes (no authentication required)
router.get("/role/:role", getPackagesByRole);
router.get("/:id", getPackageById);

// User routes (authentication required)
router.post("/purchase", authenticateUser, purchasePackage);
router.get("/user/:userId", authenticateUser, requireOwnershipOrAdmin('userId'), getUserPackages);
router.get("/usage/:userId", authenticateUser, requireOwnershipOrAdmin('userId'), getUserPackageUsage);

// Admin routes (authentication + admin required)
router.get("/admin/all", authenticateUser, requireAdmin, getAllPackages);
router.post("/admin/create", authenticateUser, requireAdmin, createPackage);
router.put("/admin/:id", authenticateUser, requireAdmin, updatePackage);
router.delete("/admin/:id", authenticateUser, requireAdmin, deletePackage);
router.get("/admin/purchases", authenticateUser, requireAdmin, getAllPackagePurchases);

module.exports = router;
