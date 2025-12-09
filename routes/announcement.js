const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const {
    getAllAnnouncements,
    getAllAnnouncementsAdmin,
    getAnnouncementById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    updateAnnouncementOrder
} = require('../controllers/announcementController');

// Public routes (no authentication required)
router.get('/announcements', getAllAnnouncements);

// Admin routes (authentication + admin required)
router.get('/admin/announcements', authenticateUser, requireAdmin, getAllAnnouncementsAdmin);
router.get('/admin/announcements/:id', authenticateUser, requireAdmin, getAnnouncementById);
router.post('/admin/announcements', authenticateUser, requireAdmin, createAnnouncement);
router.put('/admin/announcements/:id', authenticateUser, requireAdmin, updateAnnouncement);
router.delete('/admin/announcements/:id', authenticateUser, requireAdmin, deleteAnnouncement);
router.put('/admin/announcements/:id/order', authenticateUser, requireAdmin, updateAnnouncementOrder);

module.exports = router;
