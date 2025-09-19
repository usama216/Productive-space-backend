const express = require('express');
const router = express.Router();
const { calculatePayment } = require('../controllers/creditController');

// Credit calculation routes (temporarily without auth for testing)
router.post('/calculate-payment', calculatePayment);

module.exports = router;
