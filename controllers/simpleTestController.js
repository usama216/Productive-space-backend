const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

exports.testDatabase = async (req, res) => {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test 1: Simple count query
    const { count, error: countError } = await supabase
      .from('Package')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError);
      return res.status(500).json({
        success: false,
        error: 'Count query failed',
        details: countError.message
      });
    }

    console.log(`✅ Found ${count} packages in database`);

    // Test 2: Get first package
    const { data: firstPackage, error: firstError } = await supabase
      .from('Package')
      .select('*')
      .limit(1);

    if (firstError) {
      console.error('❌ First package query failed:', firstError);
      return res.status(500).json({
        success: false,
        error: 'First package query failed',
        details: firstError.message
      });
    }

    console.log('✅ First package:', firstPackage);

    res.json({
      success: true,
      message: 'Database connection successful',
      packageCount: count,
      firstPackage: firstPackage?.[0] || null
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
};
