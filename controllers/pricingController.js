const supabase = require('../config/database');

// Get all pricing configurations
const getAllPricingConfigurations = async (req, res) => {
  try {
    const { data: pricingConfigs, error } = await supabase
      .from('pricing_configuration')
      .select('*')
      .eq('isActive', true)
      .order('location', { ascending: true })
      .order('memberType', { ascending: true });

    if (error) {
      console.error('❌ Error fetching pricing configurations:', error);
      return res.status(500).json({ error: 'Failed to fetch pricing configurations' });
    }

    res.json({
      success: true,
      data: pricingConfigs,
      count: pricingConfigs.length
    });
  } catch (error) {
    console.error('❌ Error in getAllPricingConfigurations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pricing configuration by location and member type
const getPricingByLocationAndMemberType = async (req, res) => {
  try {
    const { location, memberType } = req.params;

    if (!location || !memberType) {
      return res.status(400).json({ error: 'Location and memberType are required' });
    }

    const { data: pricing, error } = await supabase
      .from('pricing_configuration')
      .select('*')
      .eq('location', location)
      .eq('memberType', memberType)
      .eq('isActive', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pricing configuration not found' });
      }
      console.error('❌ Error fetching pricing configuration:', error);
      return res.status(500).json({ error: 'Failed to fetch pricing configuration' });
    }

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('❌ Error in getPricingByLocationAndMemberType:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create or update pricing configuration
const upsertPricingConfiguration = async (req, res) => {
  try {
    const { location, memberType, oneHourRate, overOneHourRate, isActive = true } = req.body;

    // Validation
    if (!location || !memberType || oneHourRate === undefined || overOneHourRate === undefined) {
      return res.status(400).json({ 
        error: 'Location, memberType, oneHourRate, and overOneHourRate are required' 
      });
    }

    if (!['STUDENT', 'MEMBER', 'TUTOR'].includes(memberType)) {
      return res.status(400).json({ 
        error: 'memberType must be STUDENT, MEMBER, or TUTOR' 
      });
    }

    if (oneHourRate < 0 || overOneHourRate < 0) {
      return res.status(400).json({ 
        error: 'All rates must be non-negative' 
      });
    }

    const { data: pricing, error } = await supabase
      .from('pricing_configuration')
      .upsert({
        location,
        memberType,
        oneHourRate: parseFloat(oneHourRate),
        overOneHourRate: parseFloat(overOneHourRate),
        isActive,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.id || null // Assuming user ID is available in req.user
      }, {
        onConflict: 'location,memberType'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error upserting pricing configuration:', error);
      return res.status(500).json({ error: 'Failed to save pricing configuration' });
    }

    res.json({
      success: true,
      message: 'Pricing configuration saved successfully',
      data: pricing
    });
  } catch (error) {
    console.error('❌ Error in upsertPricingConfiguration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete pricing configuration (soft delete)
const deletePricingConfiguration = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('pricing_configuration')
      .update({
        isActive: false,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.id || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error deleting pricing configuration:', error);
      return res.status(500).json({ error: 'Failed to delete pricing configuration' });
    }

    res.json({
      success: true,
      message: 'Pricing configuration deleted successfully',
      data
    });
  } catch (error) {
    console.error('❌ Error in deletePricingConfiguration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pricing configuration by ID
const getPricingConfigurationById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: pricing, error } = await supabase
      .from('pricing_configuration')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pricing configuration not found' });
      }
      console.error('❌ Error fetching pricing configuration:', error);
      return res.status(500).json({ error: 'Failed to fetch pricing configuration' });
    }

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('❌ Error in getPricingConfigurationById:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all pricing for a location in a single call (for frontend consumption)
const getAllPricingForLocation = async (req, res) => {
  try {
    const { location } = req.params;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const { data: pricingConfigs, error } = await supabase
      .from('pricing_configuration')
      .select('*')
      .eq('location', location)
      .eq('isActive', true)
      .order('memberType', { ascending: true });

    if (error) {
      console.error('❌ Error fetching pricing configurations:', error);
      return res.status(500).json({ error: 'Failed to fetch pricing configurations' });
    }

    // Transform data into a format similar to the old static pricing structure
    const pricingData = {
      student: { oneHourRate: 0, overOneHourRate: 0 },
      member: { oneHourRate: 0, overOneHourRate: 0 },
      tutor: { oneHourRate: 0, overOneHourRate: 0 }
    };

    // Map the database results to the pricing structure
    pricingConfigs.forEach(config => {
      const memberTypeKey = config.memberType.toLowerCase();
      if (pricingData[memberTypeKey]) {
        pricingData[memberTypeKey] = {
          oneHourRate: parseFloat(config.oneHourRate),
          overOneHourRate: parseFloat(config.overOneHourRate)
        };
      }
    });

    res.json({
      success: true,
      data: pricingData,
      location: location
    });
  } catch (error) {
    console.error('❌ Error in getAllPricingForLocation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllPricingConfigurations,
  getPricingByLocationAndMemberType,
  getAllPricingForLocation,
  upsertPricingConfiguration,
  deletePricingConfiguration,
  getPricingConfigurationById
};
