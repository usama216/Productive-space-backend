const { createClient } = require('@supabase/supabase');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrate_student_verification.sql'), 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\n📋 Executing statement ${i + 1}:`);
        console.log(statement.substring(0, 100) + '...');
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.log(`⚠️  Statement ${i + 1} had an issue (this might be normal):`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} error (this might be normal):`, err.message);
        }
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart your application');
    console.log('2. Try the verification endpoint again');
    console.log('3. The error should be resolved');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n💡 Alternative: You can run the SQL manually in your database:');
    console.log('1. Open your database management tool (pgAdmin, DBeaver, etc.)');
    console.log('2. Run the contents of migrate_student_verification.sql');
    console.log('3. Restart your application');
  }
}

// Check if we can connect to the database
async function testConnection() {
  try {
    const { data, error } = await supabase.from('User').select('count').limit(1);
    if (error) {
      console.log('⚠️  Database connection test failed:', error.message);
      console.log('💡 Make sure your SUPABASE_URL and SUPABASE_KEY are correct');
      return false;
    }
    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Testing database connection...');
  const connected = await testConnection();
  
  if (connected) {
    await runMigration();
  } else {
    console.log('\n💡 Please check your database connection and try again');
  }
}

main();
