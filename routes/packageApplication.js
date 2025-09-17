const express = require('express');
const router = express.Router();
const packageApplicationController = require('../controllers/packageApplicationController');

router.post('/apply-package', packageApplicationController.applyPackageToBooking);
router.get('/user-packages/:userId/:userRole', packageApplicationController.getUserPackagesForBooking);
router.post('/calculate-discount', packageApplicationController.calculatePackageDiscount);

module.exports = router;
