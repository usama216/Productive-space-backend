const express = require("express");
const router = express.Router();

const {
  generateOpenLink,
  openDoor,
  getDoorAccessLogs
} = require("../controllers/doorController");

// Generate a secure access link to open the door
router.post("/generate-open-link", generateOpenLink);

// Open door using token (GET request for easy link clicking)
router.get("/open-door", openDoor);

module.exports = router;
