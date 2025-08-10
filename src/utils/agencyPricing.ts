import { supabase } from '@/integrations/supabase/client';

export type PriceType = 'selling_price' | 'billing_price';

interface AgencyPricingSetting {
  agency_id: string;
  price_type: PriceType;
}

// Cache for agency pricing settings to avoid repeated database calls
let pricingCache: { [agencyId: string]: PriceType } = {};
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get the price type that an agency should use for sales
 * Returns 'billing_price' as default if no setting is found
 */
export const getAgencyPriceType = async (agencyId: string): Promise<PriceType> => {
  try {
    // Check cache first
    const now = Date.now();
    if (cacheExpiry > now && pricingCache[agencyId]) {
      return pricingCache[agencyId];
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('agency_pricing_settings')
      .select('agency_id, price_type')
      .eq('agency_id', agencyId)
      .single();

    if (error && !error.message.includes('No rows found')) {
      console.warn('Error fetching agency pricing setting:', error);
    }

    const priceType: PriceType = data?.price_type || 'billing_price'; // Default to billing_price
    
    // Update cache
    pricingCache[agencyId] = priceType;
    cacheExpiry = now + CACHE_DURATION;

    return priceType;
  } catch (error) {
    console.warn('Error in getAgencyPriceType:', error);
    return 'billing_price'; // Default fallback
  }
};

/**
 * Get all agency pricing settings at once
 * Useful for bulk operations or initialization
 */
export const getAllAgencyPricingSettings = async (): Promise<{ [agencyId: string]: PriceType }> => {
  try {
    const { data, error } = await supabase
      .from('agency_pricing_settings')
      .select('agency_id, price_type');

    if (error && !error.message.includes('does not exist')) {
      console.warn('Error fetching all agency pricing settings:', error);
    }

    const settings: { [agencyId: string]: PriceType } = {};
    
    if (data) {
      data.forEach((setting: AgencyPricingSetting) => {
        settings[setting.agency_id] = setting.price_type;
      });
    }

    // Update cache
    pricingCache = { ...pricingCache, ...settings };
    cacheExpiry = Date.now() + CACHE_DURATION;

    return settings;
  } catch (error) {
    console.warn('Error in getAllAgencyPricingSettings:', error);
    return {};
  }
};

/**
 * Clear the pricing cache (useful when settings are updated)
 */
export const clearPricingCache = () => {
  pricingCache = {};
  cacheExpiry = 0;
};

/**
 * Get the appropriate price from a product based on agency settings
 */
export const getProductPriceForAgency = (product: any, priceType: PriceType): number => {
  if (priceType === 'selling_price') {
    return product.sellingPrice || product.selling_price || 0;
  } else {
    return product.billingPrice || product.billing_price || 0;
  }
};

/**
 * Get the price label based on price type
 */
export const getPriceTypeLabel = (priceType: PriceType): string => {
  return priceType === 'selling_price' ? 'Selling Price' : 'Billing Price';
};