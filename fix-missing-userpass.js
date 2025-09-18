const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function createMissingUserPasses() {
  console.log('🔍 Creating missing UserPass records...');
  
  // Get package purchase details
  const { data: purchase, error: purchaseError } = await supabase
    .from('PackagePurchase')
    .select(`
      *,
      Package (
        id,
        name,
        packageType,
        passCount,
        validityDays
      )
    `)
    .eq('id', '2d8dd178-ea04-481c-96b6-c27b20d5f8ad')
    .single();
    
  if (purchaseError) {
    console.error('❌ Error fetching purchase:', purchaseError);
    return;
  }
  
  console.log('📦 Package Purchase:', {
    id: purchase.id,
    packageName: purchase.Package.name,
    packageType: purchase.Package.packageType,
    passCount: purchase.Package.passCount,
    validityDays: purchase.Package.validityDays
  });
  
  // Create UserPass record
  const userPassData = {
    id: uuidv4(),
    packagepurchaseid: purchase.id,
    userId: purchase.userId,
    passtype: purchase.Package.packageType,
    totalCount: purchase.Package.passCount,
    remainingCount: purchase.Package.passCount,
    status: 'ACTIVE',
    usedat: null,
    bookingid: null,
    locationid: null,
    starttime: null,
    endtime: null,
    expiresAt: purchase.expiresAt,
    createdat: new Date().toISOString(),
    updatedat: new Date().toISOString()
  };
  
  console.log('📝 UserPass data to insert:', userPassData);
  
  const { data: insertedPass, error: insertError } = await supabase
    .from('UserPass')
    .insert([userPassData])
    .select()
    .single();
    
  if (insertError) {
    console.error('❌ Error inserting UserPass:', insertError);
  } else {
    console.log('✅ UserPass created successfully:', insertedPass);
  }
}

createMissingUserPasses();
