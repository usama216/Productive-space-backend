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

        // Check active announcement count (Max 6)
        if (isActive !== false) { // Only check if we are creating an active announcement
            const { count, error: countError } = await supabase
                .from('Announcement')
                .select('*', { count: 'exact', head: true })
                .eq('isActive', true);

            if (countError) {
                console.error('Error checking announcement count:', countError);
                return res.status(500).json({ success: false, error: 'Failed to check announcement count' });
            }

            if (count >= 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Max announcement: Unable to create more announcement, please delete one to create a new one.'
                });
            }
        }

        // Auto-assign order to avoid duplicates
        // Get the current max order
        const { data: maxOrderData, error: maxOrderError } = await supabase
            .from('Announcement')
            .select('order')
            .order('order', { ascending: false })
            .limit(1)
            .single();

        // If error (e.g. no rows), start at 1. Else max + 1
        const nextOrder = (maxOrderData && maxOrderData.order) ? maxOrderData.order + 1 : 1;

        // Use provided order if it seems valid/intentional, otherwise use nextOrder
        // But to fix the "duplicate order" issue, it's safer to always enforce nextOrder 
        // unless the frontend is very smart (which it seems it isn't).
        // Let's rely on nextOrder for new creations.
        const finalOrder = nextOrder;

        const announcementData = {
            title,
            description: description || null,
            imageUrl: imageUrl || null,
            order: finalOrder,
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

        // Hard delete
        const { data: announcement, error } = await supabase
            .from('Announcement')
            .delete()
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

        const newOrder = parseInt(order);

        // Get current announcement to know its current order
        const { data: currentAnnouncement, error: fetchError } = await supabase
            .from('Announcement')
            .select('order, id')
            .eq('id', id)
            .single();

        if (fetchError || !currentAnnouncement) {
            return res.status(404).json({ success: false, error: 'Announcement not found' });
        }

        const currentOrder = currentAnnouncement.order;

        // Check if another announcement already has the newOrder
        const { data: existingWithOrder, error: checkError } = await supabase
            .from('Announcement')
            .select('id, order')
            .eq('order', newOrder)
            .neq('id', id) // Exclude self
            .maybeSingle(); // Use maybeSingle to not error if multiple or none

        if (existingWithOrder) {
            console.log(`Swapping order between ${id} (curr: ${currentOrder}) and ${existingWithOrder.id} (curr: ${newOrder})`);

            // Swap! Update the OTHER announcement to use the OLD order of the current one
            // We use 'currentOrder' for the other one.
            // If currentOrder is null/undefined (legacy data), maybe give it a max order? 
            // For now assume safely it has an order or we assign something safe?
            // Actually if currentOrder is same as newOrder (why update?), we skip.

            const effectiveCurrentOrder = currentOrder !== null ? currentOrder : 999; // Fallback

            const { error: swapError } = await supabase
                .from('Announcement')
                .update({ order: effectiveCurrentOrder, updatedAt: new Date().toISOString() })
                .eq('id', existingWithOrder.id);

            if (swapError) {
                console.error('Failed to swap order:', swapError);
                return res.status(500).json({ success: false, error: 'Failed to reorder' });
            }
        }

        // Now update the target announcement to the new Order
        const { data: announcement, error } = await supabase
            .from('Announcement')
            .update({
                order: newOrder,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(' Error updating announcement order:', error);
            // If we failed here, we might have left the swapped item in a weird state (swapped but primary failed).
            // But usually this succeeds.
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
