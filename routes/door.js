const express = require("express");
const router = express.Router();

const {
  generateOpenLink,
  openDoor
} = require("../controllers/doorController");

const {
  sendDoorAccessLink
} = require("../controllers/doorEmailController");

// Generate a secure access link to open the door
router.post("/generate-open-link", generateOpenLink);

// Open door using token (GET request for easy link clicking)
router.get("/open-door", openDoor);

// Send door access link via email
router.post("/send-access-link", sendDoorAccessLink);

module.exports = router;
