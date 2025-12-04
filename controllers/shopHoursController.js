const supabase = require('../config/database');

/**
 * Get operating hours for a specific location
 * @route GET /api/shop-hours/operating/:location
 */
const getOperatingHours = async (req, res) => {
    try {
        const { location } = req.params;

        const { data, error } = await supabase
            .from('OperatingHours')
            .select('*')
            .eq('location', location)
            .eq('isActive', true)
            .order('dayOfWeek', { ascending: true });

        if (error) {
            console.error('Error fetching operating hours:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch operating hours',
                error: error.message
            });
        }

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error in getOperatingHours:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Update operating hours for a specific day
 * @route PUT /api/shop-hours/operating/:id
 */
const updateOperatingHours = async (req, res) => {
    try {
        const { id } = req.params;
        const { openTime, closeTime, isActive } = req.body;

        if (!openTime || !closeTime) {
            return res.status(400).json({
                success: false,
                message: 'Open time and close time are required'
            });
        }

        const { data, error } = await supabase
            .from('OperatingHours')
            .update({
                openTime,
                closeTime,
                isActive: isActive !== undefined ? isActive : true,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating operating hours:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update operating hours',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'Operating hours updated successfully',
            data
        });
    } catch (error) {
        console.error('Error in updateOperatingHours:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get closure dates for a specific location
 * @route GET /api/shop-hours/closures/:location
 */
const getClosureDates = async (req, res) => {
    try {
        const { location } = req.params;

        const { data, error } = await supabase
            .from('ClosureDates')
            .select('*')
            .eq('location', location)
            .eq('isActive', true)
            .order('startDate', { ascending: true });

        if (error) {
            console.error('Error fetching closure dates:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch closure dates',
                error: error.message
            });
        }

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error in getClosureDates:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Create a new closure date
 * @route POST /api/shop-hours/closures
 */
const createClosureDate = async (req, res) => {
    try {
        const { location, startDate, endDate, reason } = req.body;

        if (!location || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Location, start date, and end date are required'
            });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

        const { data, error } = await supabase
            .from('ClosureDates')
            .insert([{
                location,
                startDate,
                endDate,
                reason: reason || 'Closure',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating closure date:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create closure date',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'Closure date created successfully',
            data
        });
    } catch (error) {
        console.error('Error in createClosureDate:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Update a closure date
 * @route PUT /api/shop-hours/closures/:id
 */
const updateClosureDate = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, reason, isActive } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

        const { data, error } = await supabase
            .from('ClosureDates')
            .update({
                startDate,
                endDate,
                reason: reason || 'Closure',
                isActive: isActive !== undefined ? isActive : true,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating closure date:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update closure date',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'Closure date updated successfully',
            data
        });
    } catch (error) {
        console.error('Error in updateClosureDate:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Delete a closure date
 * @route DELETE /api/shop-hours/closures/:id
 */
const deleteClosureDate = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('ClosureDates')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting closure date:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete closure date',
                error: error.message
            });
        }

        res.json({
            success: true,
            message: 'Closure date deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteClosureDate:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Check if a time slot is available (not during closure or outside operating hours)
 * @route POST /api/shop-hours/check-availability
 */
/**
 * Internal helper to validate shop availability
 * @param {string} location 
 * @param {string|Date} startAt 
 * @param {string|Date} endAt 
 * @returns {Promise<{available: boolean, reason?: string}>}
 */
const validateShopAvailability = async (location, startAt, endAt) => {
    try {
        const startDate = new Date(startAt);
        const endDate = new Date(endAt);

        // Convert to Singapore timezone (GMT+8) for checking operating hours
        const singaporeStartDate = new Date(startDate.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
        const singaporeEndDate = new Date(endDate.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));

        // Check 1: Operating Hours (using Singapore timezone)
        const dayOfWeek = singaporeStartDate.getDay(); // 0=Sunday, 1=Monday, etc.
        const startTime = singaporeStartDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        const endTime = singaporeEndDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

        const { data: operatingHours, error: opError } = await supabase
            .from('OperatingHours')
            .select('*')
            .eq('location', location)
            .eq('dayOfWeek', dayOfWeek)
            .eq('isActive', true)
            .single();

        if (opError || !operatingHours) {
            return { available: false, reason: 'Shop is closed on this day' };
        }

        // Compare times (simple string comparison works for HH:MM format)
        if (startTime < operatingHours.openTime || endTime > operatingHours.closeTime) {
            return {
                available: false,
                reason: `Shop operating hours: ${operatingHours.openTime} - ${operatingHours.closeTime}`
            };
        }

        // Check 2: Closure Dates
        const { data: closures, error: closureError } = await supabase
            .from('ClosureDates')
            .select('*')
            .eq('location', location)
            .eq('isActive', true)
            .lte('startDate', endAt)
            .gte('endDate', startAt);

        if (closureError) {
            console.error('Error checking closures:', closureError);
        }

        if (closures && closures.length > 0) {
            const closure = closures[0];
            return {
                available: false,
                reason: `Shop is closed: ${closure.reason || 'Special closure'}`
            };
        }

        return { available: true };
    } catch (error) {
        console.error('Error in validateShopAvailability:', error);
        throw error;
    }
};

/**
 * Check if a time slot is available (not during closure or outside operating hours)
 * @route POST /api/shop-hours/check-availability
 */
const checkAvailability = async (req, res) => {
    try {
        const { location, startAt, endAt } = req.body;

        if (!location || !startAt || !endAt) {
            return res.status(400).json({
                success: false,
                message: 'Location, start time, and end time are required'
            });
        }

        const result = await validateShopAvailability(location, startAt, endAt);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error in checkAvailability:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getOperatingHours,
    updateOperatingHours,
    getClosureDates,
    createClosureDate,
    updateClosureDate,
    deleteClosureDate,
    deleteClosureDate,
    checkAvailability,
    validateShopAvailability
};
