const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const {
    getOperatingHours,
    updateOperatingHours,
    getClosureDates,
    createClosureDate,
    updateClosureDate,
    deleteClosureDate,
    checkAvailability
} = require('../controllers/shopHoursController');

// Public routes (for booking page)
router.get('/operating/:location', getOperatingHours);
router.get('/closures/:location', getClosureDates);
router.post('/check-availability', checkAvailability);

// Admin routes (require authentication and admin access)
router.put('/operating/:id', authenticateUser, requireAdmin, updateOperatingHours);
router.post('/closures', authenticateUser, requireAdmin, createClosureDate);
router.put('/closures/:id', authenticateUser, requireAdmin, updateClosureDate);
router.delete('/closures/:id', authenticateUser, requireAdmin, deleteClosureDate);

module.exports = router;
