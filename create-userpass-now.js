const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function createUserPassNow() {
  try {
    console.log('🚀 Creating UserPass record immediately...');
    
    // Get package details
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
    
    console.log('📦 Package details:', {
      id: purchase.id,
      packageName: purchase.Package.name,
      packageType: purchase.Package.packageType,
      passCount: purchase.Package.passCount
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
    
    console.log('📝 Creating UserPass with data:', userPassData);
    
    const { data: insertedPass, error: insertError } = await supabase
      .from('UserPass')
      .insert([userPassData])
      .select()
      .single();
      
    if (insertError) {
      console.error('❌ Error inserting UserPass:', insertError);
      console.error('❌ Error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('✅ UserPass created successfully!');
      console.log('✅ Inserted data:', insertedPass);
    }
    
  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

createUserPassNow();
