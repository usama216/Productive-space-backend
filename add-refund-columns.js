const supabase = require('./config/database');

async function addRefundColumns() {
  try {
    console.log('🔧 Adding refund columns to Booking table...');
    
    // Add refundstatus column
    const { error: statusError } = await supabase.rpc('exec', {
      sql: `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS refundstatus character varying DEFAULT 'NONE'::character varying;`
    });
    
    if (statusError) {
      console.log('Status column error:', statusError);
    } else {
      console.log('✅ Added refundstatus column');
    }
    
    // Add refundrequestedat column
    const { error: requestedError } = await supabase.rpc('exec', {
      sql: `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS refundrequestedat timestamp with time zone;`
    });
    
    if (requestedError) {
      console.log('Requested at column error:', requestedError);
    } else {
      console.log('✅ Added refundrequestedat column');
    }
    
    // Add refundreason column
    const { error: reasonError } = await supabase.rpc('exec', {
      sql: `ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS refundreason text;`
    });
    
    if (reasonError) {
      console.log('Reason column error:', reasonError);
    } else {
      console.log('✅ Added refundreason column');
    }
    
    console.log('🎉 Refund columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addRefundColumns();
