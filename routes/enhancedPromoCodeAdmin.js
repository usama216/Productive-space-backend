const express = require("express");
const {
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getAllPromoCodes,
  getPromoCodeById,
  getPromoCodesByTimeStatus,
  getPromoCodeUsageStats
} = require("../controllers/enhancedPromoCodeAdminController");

const router = express.Router();

// ==================== ADMIN ROUTES ====================
// These routes are for admin management of promo codes

// Create new promo code
router.post("/create", createPromoCode);

// Update existing promo code
router.put("/:id", updatePromoCode);

// Delete promo code
router.delete("/:id", deletePromoCode);

// Get all promo codes with pagination and filters
router.get("/all", getAllPromoCodes);

// Get specific promo code details
router.get("/:id", getPromoCodeById);

// Get promo codes by time status
router.get("/time-status", getPromoCodesByTimeStatus);

// Get promo code usage statistics
router.get("/:promoCodeId/stats", getPromoCodeUsageStats);

module.exports = router;
