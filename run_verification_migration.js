const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function runMigration() {
  try {
    console.log('🔄 Running verification history migration...');
    
    // Create the table using raw SQL
    const { error } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS "VerificationHistory" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "previousStatus" TEXT,
          "newStatus" TEXT NOT NULL,
          "reason" TEXT,
          "changedBy" TEXT,
          "changedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS "idx_verification_history_user_id" ON "VerificationHistory"("userId");
        CREATE INDEX IF NOT EXISTS "idx_verification_history_changed_at" ON "VerificationHistory"("changedAt");
      `
    });
    
    if (error) {
      console.error('❌ Migration error:', error);
      return false;
    }
    
    console.log('✅ VerificationHistory table created successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration error:', error);
    return false;
  }
}

runMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('💥 Migration failed!');
      process.exit(1);
    }
  });
