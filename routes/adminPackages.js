const express = require("express");
const router = express.Router();

const {
  getPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  getPackageStats
} = require("../controllers/adminPackageController");

router.get("/", getPackages);
router.get("/stats", getPackageStats);
router.get("/:id", getPackageById);
router.post("/", createPackage);
router.put("/:id", updatePackage);
router.delete("/:id", deletePackage);
router.patch("/:id/toggle-status", togglePackageStatus);

module.exports = router;
