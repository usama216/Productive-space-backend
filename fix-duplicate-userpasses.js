const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function fixDuplicateUserPasses() {
  try {
    console.log('🔍 Finding duplicate UserPass entries...\n');

    // Get all PackagePurchase IDs
    const { data: purchases, error: purchaseError } = await supabase
      .from('PackagePurchase')
      .select('id, orderId');

    if (purchaseError) {
      console.error('❌ Error fetching purchases:', purchaseError);
      return;
    }

    console.log(`📦 Found ${purchases.length} package purchases\n`);

    let fixedCount = 0;
    let deletedCount = 0;

    for (const purchase of purchases) {
      // Get all UserPass entries for this purchase
      const { data: passes, error: passError } = await supabase
        .from('UserPass')
        .select('*')
        .eq('packagepurchaseid', purchase.id)
        .order('createdat', { ascending: true });

      if (passError) {
        console.error(`❌ Error fetching passes for ${purchase.orderId}:`, passError);
        continue;
      }

      if (passes.length > 1) {
        console.log(`🔧 Found ${passes.length} UserPass entries for purchase ${purchase.orderId}`);
        
        // Keep the first one (oldest), delete the rest
        const toKeep = passes[0];
        const toDelete = passes.slice(1);

        console.log(`  ✅ Keeping: ${toKeep.id} (totalCount: ${toKeep.totalCount}, remaining: ${toKeep.remainingCount})`);
        
        for (const duplicate of toDelete) {
          const { error: deleteError } = await supabase
            .from('UserPass')
            .delete()
            .eq('id', duplicate.id);

          if (deleteError) {
            console.error(`  ❌ Error deleting duplicate ${duplicate.id}:`, deleteError);
          } else {
            console.log(`  🗑️ Deleted duplicate: ${duplicate.id}`);
            deletedCount++;
          }
        }

        fixedCount++;
        console.log('');
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log(`📊 Fixed ${fixedCount} purchases with duplicates`);
    console.log(`🗑️ Deleted ${deletedCount} duplicate UserPass entries`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
fixDuplicateUserPasses();

