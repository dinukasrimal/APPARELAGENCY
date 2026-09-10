import { supabase } from '@/integrations/supabase/client';

// Cache for per-agency excluded product IDs, mirrors agencyPricing.ts's pattern.
let exclusionCache: { [agencyId: string]: Set<string> } = {};
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Product IDs hidden for a specific agency (in addition to any globally
 * inactive product). Cached per-agency for CACHE_DURATION.
 */
export const getExcludedProductIdsForAgency = async (agencyId: string): Promise<Set<string>> => {
  try {
    const now = Date.now();
    if (cacheExpiry > now && exclusionCache[agencyId]) {
      return exclusionCache[agencyId];
    }

    const { data, error } = await supabase
      .from('agency_product_exclusions')
      .select('product_id')
      .eq('agency_id', agencyId);

    if (error) {
      console.warn('Error fetching agency product exclusions:', error);
    }

    const excluded = new Set((data || []).map(row => row.product_id));
    exclusionCache[agencyId] = excluded;
    cacheExpiry = now + CACHE_DURATION;
    return excluded;
  } catch (error) {
    console.warn('Error in getExcludedProductIdsForAgency:', error);
    return new Set();
  }
};

/** Clear the cache — call after the admin form changes a product's visibility. */
export const clearProductVisibilityCache = () => {
  exclusionCache = {};
  cacheExpiry = 0;
};

/**
 * Drops globally inactive products and products excluded for this specific
 * agency. Pass an empty Set for excludedIds to skip the per-agency check.
 */
export const filterActiveProducts = <T extends { id: string; is_active?: boolean | null }>(
  products: T[],
  excludedIds: Set<string>
): T[] => products.filter(p => p.is_active !== false && !excludedIds.has(p.id));
