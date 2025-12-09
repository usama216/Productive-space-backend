const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { calculatePayment } = require('../controllers/creditController');

// User routes (authentication required)
router.post('/calculate-payment', authenticateUser, calculatePayment);

module.exports = router;
