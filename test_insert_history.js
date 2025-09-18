const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function insertTestHistory() {
  try {
    console.log('🧪 Inserting test verification history...');
    
    const testHistory = [
      {
        userId: 'b90c181e-874d-46c2-b1c8-3a510bbdef48',
        previousStatus: 'PENDING',
        newStatus: 'REJECTED',
        reason: 'Document not clear - please resubmit',
        changedBy: 'admin',
        changedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      },
      {
        userId: 'b90c181e-874d-46c2-b1c8-3a510bbdef48',
        previousStatus: 'REJECTED',
        newStatus: 'VERIFIED',
        reason: 'Student verification approved',
        changedBy: 'admin',
        changedAt: new Date().toISOString() // Now
      }
    ];
    
    const { data, error } = await supabase
      .from('VerificationHistory')
      .insert(testHistory);
    
    if (error) {
      console.error('❌ Error inserting test history:', error);
      return false;
    }
    
    console.log('✅ Test verification history inserted successfully!');
    console.log('📋 Inserted records:', data);
    
    // Test the API
    const response = await fetch('http://localhost:8000/api/verification-history/b90c181e-874d-46c2-b1c8-3a510bbdef48');
    const result = await response.json();
    console.log('🔍 API Response:', result);
    
    return true;
  } catch (error) {
    console.error('❌ Test error:', error);
    return false;
  }
}

insertTestHistory()
  .then(success => {
    if (success) {
      console.log('🎉 Test completed successfully!');
      process.exit(0);
    } else {
      console.log('💥 Test failed!');
      process.exit(1);
    }
  });
