const supabase = require('../config/database');

/**
 * Get all active announcements (Public endpoint)
 * @route GET /api/announcements
 */
const getAllAnnouncements = async (req, res) => {
    try {
        const { data: announcements, error } = await supabase
            .from('Announcement')
            .select('*')
            .eq('isActive', true)
            .order('order', { ascending: true });

        if (error) {
            console.error(' Error fetching announcements:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch announcements'
            });
        }

        res.json({
            success: true,
            data: announcements,
            count: announcements.length
        });
    } catch (error) {
        console.error(' Error in getAllAnnouncements:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get all announcements including inactive ones (Admin endpoint)
 * @route GET /api/admin/announcements
 */
const getAllAnnouncementsAdmin = async (req, res) => {
    try {
        const { data: announcements, error } = await supabase
            .from('Announcement')
            .select('*')
            .order('order', { ascending: true });

        if (error) {
            console.error(' Error fetching announcements (admin):', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch announcements'
            });
        }

        res.json({
            success: true,
            data: announcements,
            count: announcements.length
        });
    } catch (error) {
        console.error(' Error in getAllAnnouncementsAdmin:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get announcement by ID
 * @route GET /api/admin/announcements/:id
 */
const getAnnouncementById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Announcement ID is required'
            });
        }

        const { data: announcement, error } = await supabase
            .from('Announcement')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: 'Announcement not found'
                });
            }
            console.error(' Error fetching announcement:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch announcement'
            });
        }

        res.json({
            success: true,
            data: announcement
        });
    } catch (error) {
        console.error(' Error in getAnnouncementById:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Create new announcement
 * @route POST /api/admin/announcements
 */
const createAnnouncement = async (req, res) => {
    try {
        const { title, description, imageUrl, order, isActive } = req.body;

        // Validation
        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Title is required'
            });
        }

        const announcementData = {
            title,
            description: description || null,
            imageUrl: imageUrl || null,
            order: order !== undefined ? parseInt(order) : 0,
            isActive: isActive !== undefined ? isActive : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const { data: announcement, error } = await supabase
            .from('Announcement')
            .insert([announcementData])
            .select()
            .single();

        if (error) {
            console.error(' Error creating announcement:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to create announcement'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Announcement created successfully',
            data: announcement
        });
    } catch (error) {
        console.error(' Error in createAnnouncement:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Update announcement
 * @route PUT /api/admin/announcements/:id
 */
const updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, imageUrl, order, isActive } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Announcement ID is required'
            });
        }

        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        // Allow clearing imageUrl by setting it to null when empty string is provided
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl === '' ? null : imageUrl;
        if (order !== undefined) updateData.order = parseInt(order);
        if (isActive !== undefined) updateData.isActive = isActive;

        const { data: announcement, error } = await supabase
            .from('Announcement')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: 'Announcement not found'
                });
            }
            console.error(' Error updating announcement:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update announcement'
            });
        }

        res.json({
            success: true,
            message: 'Announcement updated successfully',
            data: announcement
        });
    } catch (error) {
        console.error(' Error in updateAnnouncement:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Delete announcement (soft delete by setting isActive to false)
 * @route DELETE /api/admin/announcements/:id
 */
const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Announcement ID is required'
            });
        }

        // Soft delete by setting isActive to false
        const { data: announcement, error } = await supabase
            .from('Announcement')
            .update({
                isActive: false,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: 'Announcement not found'
                });
            }
            console.error(' Error deleting announcement:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete announcement'
            });
        }

        res.json({
            success: true,
            message: 'Announcement deleted successfully',
            data: announcement
        });
    } catch (error) {
        console.error(' Error in deleteAnnouncement:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Update announcement order
 * @route PUT /api/admin/announcements/:id/order
 */
const updateAnnouncementOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { order } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Announcement ID is required'
            });
        }

        if (order === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Order is required'
            });
        }

        const { data: announcement, error } = await supabase
            .from('Announcement')
            .update({
                order: parseInt(order),
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: 'Announcement not found'
                });
            }
            console.error(' Error updating announcement order:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update announcement order'
            });
        }

        res.json({
            success: true,
            message: 'Announcement order updated successfully',
            data: announcement
        });
    } catch (error) {
        console.error(' Error in updateAnnouncementOrder:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

module.exports = {
    getAllAnnouncements,
    getAllAnnouncementsAdmin,
    getAnnouncementById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    updateAnnouncementOrder
};
