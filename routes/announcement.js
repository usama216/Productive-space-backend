const express = require('express');
const router = express.Router();
const {
    getAllAnnouncements,
    getAllAnnouncementsAdmin,
    getAnnouncementById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    updateAnnouncementOrder
} = require('../controllers/announcementController');

// Public routes
router.get('/announcements', getAllAnnouncements);

// Admin routes
router.get('/admin/announcements', getAllAnnouncementsAdmin);
router.get('/admin/announcements/:id', getAnnouncementById);
router.post('/admin/announcements', createAnnouncement);
router.put('/admin/announcements/:id', updateAnnouncement);
router.delete('/admin/announcements/:id', deleteAnnouncement);
router.put('/admin/announcements/:id/order', updateAnnouncementOrder);

module.exports = router;
