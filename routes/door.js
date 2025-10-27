const express = require("express");
const router = express.Router();

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

// Generate a secure access link to open the door
router.post("/generate-open-link", generateOpenLink);

// Generate a secure access link for admin with manual seat and time
router.post("/admin-generate-open-link", adminGenerateOpenLink);

// Open door using token (GET request for easy link clicking)
router.get("/open-door", openDoor);

// Send door access link via email
router.post("/send-access-link", sendDoorAccessLink);

// Send admin door access link via email
router.post("/send-admin-access-link", sendAdminDoorAccessLink);

module.exports = router;
