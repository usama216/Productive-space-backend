require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testHoursConfig() {
  try {
    console.log('🧪 Testing hours configuration...');
    
    // Test creating a package with hours configuration
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
      packageContents: {
        halfDayHours: 5,  // Custom 5 hours instead of default 4
        fullDayHours: 9,  // Custom 9 hours instead of default 8
        complimentaryHours: 1,  // 1 bonus hour
        totalHours: 6  // Total: 5 + 1 = 6 hours
      }
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
    console.log(`  - Half-Day Hours: ${createdPackage.packageContents.halfDayHours}`);
    console.log(`  - Full-Day Hours: ${createdPackage.packageContents.fullDayHours}`);
    console.log(`  - Complimentary Hours: ${createdPackage.packageContents.complimentaryHours}`);
    console.log(`  - Total Hours: ${createdPackage.packageContents.totalHours}`);
    
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
    console.log(`  - Half-Day Hours: ${fetchedPackage.packageContents.halfDayHours}`);
    console.log(`  - Full-Day Hours: ${fetchedPackage.packageContents.fullDayHours}`);
    console.log(`  - Complimentary Hours: ${fetchedPackage.packageContents.complimentaryHours}`);
    console.log(`  - Total Hours: ${fetchedPackage.packageContents.totalHours}`);
    
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
    
    console.log('\n🎉 Hours configuration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testHoursConfig();
