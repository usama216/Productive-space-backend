require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function debugUserPass() {
  console.log('🔍 Debugging UserPass for package purchase: 2d8dd178-ea04-481c-96b6-c27b20d5f8ad');
  
  // Check what UserPass records exist
  const { data: allUserPass, error: allError } = await supabase
    .from('UserPass')
    .select('*')
    .eq('packagepurchaseid', '2d8dd178-ea04-481c-96b6-c27b20d5f8ad');
  
  console.log('All UserPass records for this package purchase:');
  console.log(JSON.stringify(allUserPass, null, 2));
  console.log('Error:', allError);
  
  // Check if there are any UserPass records at all
  const { data: anyUserPass, error: anyError } = await supabase
    .from('UserPass')
    .select('*')
    .limit(5);
  
  console.log('\nAny UserPass records (first 5):');
  console.log(JSON.stringify(anyUserPass, null, 2));
  
  // If no UserPass records exist, create them
  if (!allUserPass || allUserPass.length === 0) {
    console.log('\n🚨 NO USERPASS RECORDS FOUND! Creating them now...');
    
    const { v4: uuidv4 } = require('uuid');
    
    const userPassData = {
      id: uuidv4(),
      packagepurchaseid: '2d8dd178-ea04-481c-96b6-c27b20d5f8ad',
      passtype: 'HALF_DAY',
      hours: 4,
      totalCount: 5,
      remainingCount: 5,
      status: 'ACTIVE',
      usedat: null,
      bookingid: null,
      locationid: null,
      starttime: null,
      endtime: null,
      expiresAt: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString(),
      createdat: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('UserPass')
      .insert([userPassData])
      .select();
    
    if (insertError) {
      console.error('❌ Error creating UserPass:', insertError);
    } else {
      console.log('✅ UserPass created successfully:', insertData);
    }
  }
}

debugUserPass().catch(console.error);
