require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('Testing package usage API...');
console.log('Environment check:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_KEY,
  supabaseUrl: process.env.SUPABASE_URL?.substring(0, 20) + '...'
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testPackageUsage() {
  try {
    console.log('📊 Testing package usage analytics...');

    // Test 1: Get packages
    console.log('1. Fetching packages...');
    const { data: packages, error: packagesError } = await supabase
      .from('Package')
      .select(`
        id,
        name,
        packageType,
        targetRole,
        price,
        createdAt
      `)
      .eq('isActive', true);

    if (packagesError) {
      console.error('❌ Error fetching packages:', packagesError);
      return;
    }

    console.log(`✅ Found ${packages.length} packages`);

    // Test 2: Get purchases for first package
    if (packages.length > 0) {
      const firstPackage = packages[0];
      console.log(`2. Testing purchases for package: ${firstPackage.name}`);
      
      const { data: purchases, error: purchasesError } = await supabase
        .from('PackagePurchase')
        .select(`
          id,
          userId,
          quantity,
          totalAmount,
          paymentStatus,
          createdAt
        `)
        .eq('packageId', firstPackage.id)
        .eq('paymentStatus', 'COMPLETED');

      if (purchasesError) {
        console.error('❌ Error fetching purchases:', purchasesError);
        return;
      }

      console.log(`✅ Found ${purchases.length} completed purchases`);

      // Test 3: Get UserPass records for first purchase
      if (purchases.length > 0) {
        const firstPurchase = purchases[0];
        console.log(`3. Testing UserPass records for purchase: ${firstPurchase.id}`);
        
        const { data: userPasses, error: passesError } = await supabase
          .from('UserPass')
          .select(`
            id,
            totalCount,
            remainingCount,
            status,
            usedAt,
            createdAt
          `)
          .eq('packagepurchaseid', firstPurchase.id);

        if (passesError) {
          console.error('❌ Error fetching UserPass records:', passesError);
          return;
        }

        console.log(`✅ Found ${userPasses.length} UserPass records`);
        console.log('Sample UserPass record:', userPasses[0]);
      }
    }

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPackageUsage();
