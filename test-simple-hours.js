require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testSimpleHours() {
  try {
    console.log('🧪 Testing simple hours configuration...');
    
    // Test creating a package with simple hours configuration
    const testPackage = {
      name: 'Test Half Day Package',
      description: 'Test package with custom hours',
      packageType: 'HALF_DAY',
      targetRole: 'MEMBER',
      price: 25.00,
      outletFee: 0.00,
      passCount: 1,
      validityDays: 30,
      isActive: true,
      hoursAllowed: 6  // Custom 6 hours instead of default 4
    };
    
    console.log('📦 Creating test package with custom hours...');
    const { data: createdPackage, error: createError } = await supabase
      .from('Package')
      .insert([testPackage])
      .select('*')
      .single();
    
    if (createError) {
      console.error('❌ Error creating test package:', createError);
      return;
    }
    
    console.log('✅ Test package created successfully!');
    console.log('📋 Package details:');
    console.log(`  - Name: ${createdPackage.name}`);
    console.log(`  - Package Type: ${createdPackage.packageType}`);
    console.log(`  - Hours Allowed: ${createdPackage.hoursAllowed}`);
    
    // Test fetching the package
    console.log('\n🔍 Fetching package to verify hours configuration...');
    const { data: fetchedPackage, error: fetchError } = await supabase
      .from('Package')
      .select('*')
      .eq('id', createdPackage.id)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching package:', fetchError);
      return;
    }
    
    console.log('✅ Package fetched successfully!');
    console.log('📋 Fetched package hours:');
    console.log(`  - Hours Allowed: ${fetchedPackage.hoursAllowed}`);
    
    // Clean up - delete the test package
    console.log('\n🧹 Cleaning up test package...');
    const { error: deleteError } = await supabase
      .from('Package')
      .delete()
      .eq('id', createdPackage.id);
    
    if (deleteError) {
      console.error('❌ Error deleting test package:', deleteError);
    } else {
      console.log('✅ Test package deleted successfully!');
    }
    
    console.log('\n🎉 Simple hours configuration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testSimpleHours();
