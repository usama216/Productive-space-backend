const express = require("express");
const {
  testEnhancedPromoCodeSystem,
  applyPromoCode,
  getUserAvailablePromos
} = require("../controllers/enhancedPromoCodeController");

const router = express.Router();

// ==================== TEST ROUTE ====================
// Test endpoint to check enhanced promo code system
router.get("/test", testEnhancedPromoCodeSystem);

// ==================== USER/CLIENT ROUTES ====================
// These routes are for users to apply and view promo codes

// Apply promo code during booking with enhanced eligibility checking
router.post("/apply", applyPromoCode);

// Get available promo codes for logged-in user with enhanced filtering
router.get("/user/:userId/available", getUserAvailablePromos);

module.exports = router;
