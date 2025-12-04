const supabase = require('../config/database');

/**
 * Create a new admin user
 * @route POST /api/admin/users/create-admin
 */
const createAdminUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long'
            });
        }

        // Check if user with this email already exists in User table
        const { data: existingUser, error: checkError } = await supabase
            .from('User')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Create user in Supabase Auth (this handles password hashing)
        // We need to use the SERVICE ROLE key to create users with admin privileges
        // Initialize a new client specifically for this admin operation
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.toLowerCase().trim(),
            password: password,
            email_confirm: true, // Auto-confirm email for admin users
            user_metadata: { role: 'admin' }
        });

        if (authError) {
            console.error('Error creating auth user:', authError);
            return res.status(500).json({
                success: false,
                error: authError.message || 'Failed to create admin user in authentication system'
            });
        }

        // Create corresponding record in User table with ADMIN memberType
        const adminUserData = {
            id: authData.user.id, // Use the same ID from auth.users
            email: email.toLowerCase().trim(),
            firstName: null,
            lastName: null,
            memberType: 'ADMIN',
            contactNumber: null,
            studentVerificationStatus: 'NA',
            studentVerificationDate: null,
            studentVerificationImageUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const { data: adminUser, error: createError } = await supabase
            .from('User')
            .insert([adminUserData])
            .select('id, email, memberType, createdAt, updatedAt')
            .single();

        if (createError) {
            console.error('Error creating admin user in User table:', createError);

            // Cleanup: Delete the auth user if User table insert fails
            await supabase.auth.admin.deleteUser(authData.user.id);

            return res.status(500).json({
                success: false,
                error: 'Failed to create admin user record'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            data: adminUser
        });

    } catch (error) {
        console.error('Error in createAdminUser:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

module.exports = {
    createAdminUser
};
