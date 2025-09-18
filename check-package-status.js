const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkPackageStatus() {
  console.log('🔍 Checking package purchase and UserPass status...');
  
  // Check PackagePurchase
  const { data: purchase, error: purchaseError } = await supabase
    .from('PackagePurchase')
    .select('*')
    .eq('id', '2d8dd178-ea04-481c-96b6-c27b20d5f8ad')
    .single();
    
  console.log('📦 PackagePurchase Status:');
  console.log('- ID:', purchase?.id);
  console.log('- Payment Status:', purchase?.paymentStatus);
  console.log('- Is Active:', purchase?.isActive);
  console.log('- Activated At:', purchase?.activatedAt);
  console.log('- Expires At:', purchase?.expiresAt);
  
  // Check UserPass records
  const { data: userPasses, error: userPassError } = await supabase
    .from('UserPass')
    .select('*')
    .eq('packagepurchaseid', '2d8dd178-ea04-481c-96b6-c27b20d5f8ad');
    
  console.log('\n🎫 UserPass Records:');
  console.log('- Count:', userPasses?.length || 0);
  if (userPasses && userPasses.length > 0) {
    userPasses.forEach((pass, index) => {
      console.log(`- Pass ${index + 1}:`);
      console.log('  - ID:', pass.id);
      console.log('  - Status:', pass.status);
      console.log('  - Total Count:', pass.totalCount);
      console.log('  - Remaining Count:', pass.remainingCount);
      console.log('  - Used At:', pass.usedat);
      console.log('  - Booking ID:', pass.bookingid);
    });
  } else {
    console.log('- No UserPass records found!');
  }
  
  // Check recent bookings with this package
  const { data: bookings, error: bookingError } = await supabase
    .from('Booking')
    .select('*')
    .eq('packageId', '2d8dd178-ea04-481c-96b6-c27b20d5f8ad')
    .eq('packageUsed', true)
    .order('createdAt', { ascending: false })
    .limit(5);
    
  console.log('\n📅 Recent Bookings with this Package:');
  console.log('- Count:', bookings?.length || 0);
  if (bookings && bookings.length > 0) {
    bookings.forEach((booking, index) => {
      console.log(`- Booking ${index + 1}:`);
      console.log('  - ID:', booking.id);
      console.log('  - Booking Ref:', booking.bookingRef);
      console.log('  - Package Used:', booking.packageUsed);
      console.log('  - Payment Confirmed:', booking.confirmedPayment);
      console.log('  - Created At:', booking.createdAt);
    });
  } else {
    console.log('- No bookings found with this package!');
  }
}

checkPackageStatus();
