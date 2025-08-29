/**
 * Shared database configuration
 * This file creates a single Supabase client instance that can be used across all controllers
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅ SET' : '❌ NOT SET');
  console.error('   SUPABASE_KEY:', supabaseKey ? '✅ SET' : '❌ NOT SET');
  console.error('💡 Make sure your .env file contains these variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
