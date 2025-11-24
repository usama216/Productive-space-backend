const express = require("express");
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");

const {
  generateOpenLink,
  adminGenerateOpenLink,
  openDoor,
  getDoorAccessLogs
} = require("../controllers/doorController");

const {
  sendDoorAccessLink,
  sendAdminDoorAccessLink
} = require("../controllers/doorEmailController");

// Generate a secure access link to open the door (requires user authentication)
router.post("/generate-open-link", authenticateUser, generateOpenLink);

// Generate a secure access link for admin with manual seat and time (requires admin authentication)
router.post("/admin-generate-open-link", authenticateUser, requireAdmin, adminGenerateOpenLink);

// Open door using token (GET request for easy link clicking)
// This route uses token-based authentication (token in query param), not JWT
// router.get("/open-door", openDoor);

// Send door access link via email (requires user authentication)
router.post("/send-access-link", authenticateUser, sendDoorAccessLink);

// Send admin door access link via email (requires admin authentication)
router.post("/send-admin-access-link", authenticateUser, requireAdmin, sendAdminDoorAccessLink);

module.exports = router;
