const express = require("express");
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");

const {
  getPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  getPackageStats
} = require("../controllers/adminPackageController");

// Apply authentication and admin check to all routes
router.use(authenticateUser, requireAdmin);

router.get("/", getPackages);
router.get("/stats", getPackageStats);
router.get("/:id", getPackageById);
router.post("/", createPackage);
router.put("/:id", updatePackage);
router.delete("/:id", deletePackage);
router.patch("/:id/toggle-status", togglePackageStatus);

module.exports = router;
