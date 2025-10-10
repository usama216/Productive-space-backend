// Cleanup duplicate UserPass records caused by race conditions
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function cleanupDuplicateUserPasses() {
  console.log('🧹 Starting cleanup of duplicate UserPass records...\n');
  
  try {
    // Get all PackagePurchase IDs
    const { data: purchases, error: purchaseError } = await supabase
      .from('PackagePurchase')
      .select('id, userId, Package(passCount)');
    
    if (purchaseError) {
      console.error('❌ Error fetching purchases:', purchaseError);
      return;
    }
    
    console.log(`📦 Found ${purchases.length} package purchases to check\n`);
    
    let totalDuplicates = 0;
    let totalDeleted = 0;
    
    for (const purchase of purchases) {
      // Get all UserPass records for this purchase
      const { data: userPasses, error: passError } = await supabase
        .from('UserPass')
        .select('id, status, remainingCount, totalCount, createdat')
        .eq('packagepurchaseid', purchase.id)
        .order('createdat', { ascending: true });
      
      if (passError) {
        console.error(`❌ Error fetching UserPass for ${purchase.id}:`, passError);
        continue;
      }
      
      // If more than 1 UserPass exists, we have duplicates
      if (userPasses && userPasses.length > 1) {
        totalDuplicates += userPasses.length - 1;
        console.log(`⚠️  Found ${userPasses.length} UserPass records for purchase ${purchase.id}`);
        console.log(`   Package passCount: ${purchase.Package.passCount}`);
        
        // Keep the first one (oldest), delete the rest
        const toKeep = userPasses[0];
        const toDelete = userPasses.slice(1);
        
        console.log(`   ✅ Keeping: ${toKeep.id} (status: ${toKeep.status}, remaining: ${toKeep.remainingCount})`);
        
        for (const pass of toDelete) {
          console.log(`   ❌ Deleting: ${pass.id} (status: ${pass.status}, remaining: ${pass.remainingCount})`);
          
          // Delete the duplicate
          const { error: deleteError } = await supabase
            .from('UserPass')
            .delete()
            .eq('id', pass.id);
          
          if (deleteError) {
            console.error(`   ❌ Error deleting ${pass.id}:`, deleteError);
          } else {
            totalDeleted++;
            console.log(`   ✅ Deleted successfully`);
          }
        }
        console.log('');
      }
    }
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`   Total purchases checked: ${purchases.length}`);
    console.log(`   Duplicate UserPass found: ${totalDuplicates}`);
    console.log(`   UserPass records deleted: ${totalDeleted}`);
    console.log('\n✅ Cleanup completed!\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupDuplicateUserPasses();

