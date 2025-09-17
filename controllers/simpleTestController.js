const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

exports.testDatabase = async (req, res) => {
  try {
    console.log('Testing database connection...');
    
   
    const { count, error: countError } = await supabase
      .from('Package')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return res.status(500).json({
        success: false,
        error: 'Count query failed',
        details: countError.message
      });
    }

    const { data: firstPackage, error: firstError } = await supabase
      .from('Package')
      .select('*')
      .limit(1);

    if (firstError) {
      return res.status(500).json({
        success: false,
        error: 'First package query failed',
        details: firstError.message
      });
    }

  
    res.json({
      success: true,
      message: 'Database connection successful',
      packageCount: count,
      firstPackage: firstPackage?.[0] || null
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
};
