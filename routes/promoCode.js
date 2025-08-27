const express = require("express");
const {
  // Test endpoint
  testPromoCodeTable,
  
  // User/Client APIs
  applyPromoCode,
  getUserAvailablePromos,
  getUserUsedPromos,
  
  // Admin APIs
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getAllPromoCodes,
  getPromoCodeById
} = require("../controllers/promoCodeController");

const router = express.Router();

// ==================== TEST ROUTE ====================
// Test endpoint to check database connection
router.get("/test", testPromoCodeTable);

// ==================== USER/CLIENT ROUTES ====================
// These routes are for users to apply and view promo codes

// Apply promo code during booking
router.post("/apply", applyPromoCode);

// Get available promo codes for logged-in user
router.get("/user/:userId/available", getUserAvailablePromos);

// Get user's used promo codes
router.get("/user/:userId/used", getUserUsedPromos);

// ==================== PUBLIC ADMIN ROUTES ====================
// These routes are now publicly accessible for testing

// Get all promo codes (public access)
router.get("/public/all", getAllPromoCodes);

// Get specific promo code details (public access)
router.get("/public/:id", getPromoCodeById);

// ==================== ADMIN ROUTES ====================
// These routes are for admin management of promo codes

// Create new promo code
router.post("/admin/create", createPromoCode);

// Update existing promo code
router.put("/admin/:id", updatePromoCode);

// Delete promo code
router.delete("/admin/:id", deletePromoCode);

// Get all promo codes with pagination and filters
router.get("/admin/all", getAllPromoCodes);

// Get specific promo code details
router.get("/admin/:id", getPromoCodeById);

module.exports = router;
