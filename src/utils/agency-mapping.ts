import { supabase } from '@/integrations/supabase/client';
import { AgencyNameMapping } from '@/types/external-targets';

// Cache for agency name mappings to reduce database calls
const agencyNameCache = new Map<string, string>();
const reverseAgencyNameCache = new Map<string, string>();
let cacheLastUpdated: Date | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get agency name by agency ID
 */
export async function getAgencyNameById(agencyId: string): Promise<string | null> {
  // Check cache first
  if (agencyNameCache.has(agencyId) && isCacheValid()) {
    return agencyNameCache.get(agencyId) || null;
  }

  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('name')
      .eq('id', agencyId)
      .single();

    if (error || !data) {
      console.error('Error fetching agency name:', error);
      return null;
    }

    // Update cache
    agencyNameCache.set(agencyId, data.name);
    reverseAgencyNameCache.set(data.name.toLowerCase(), agencyId);
    cacheLastUpdated = new Date();

    return data.name;
  } catch (error) {
    console.error('Error in getAgencyNameById:', error);
    return null;
  }
}

/**
 * Get agency ID by agency name (case-insensitive)
 */
export async function getAgencyIdByName(agencyName: string): Promise<string | null> {
  const normalizedName = agencyName.toLowerCase();
  
  // Check cache first
  if (reverseAgencyNameCache.has(normalizedName) && isCacheValid()) {
    return reverseAgencyNameCache.get(normalizedName) || null;
  }

  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name')
      .ilike('name', agencyName);

    if (error || !data || data.length === 0) {
      console.error('Error fetching agency ID:', error);
      return null;
    }

    // Find exact match (case-insensitive)
    const exactMatch = data.find(agency => 
      agency.name.toLowerCase() === normalizedName
    );

    if (exactMatch) {
      // Update cache
      agencyNameCache.set(exactMatch.id, exactMatch.name);
      reverseAgencyNameCache.set(normalizedName, exactMatch.id);
      cacheLastUpdated = new Date();
      
      return exactMatch.id;
    }

    // If no exact match, try fuzzy matching
    const fuzzyMatch = data.find(agency => 
      agency.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(agency.name.toLowerCase())
    );

    if (fuzzyMatch) {
      console.warn(`Fuzzy match found for agency name: "${agencyName}" -> "${fuzzyMatch.name}"`);
      return fuzzyMatch.id;
    }

    return null;
  } catch (error) {
    console.error('Error in getAgencyIdByName:', error);
    return null;
  }
}

/**
 * Get all agency name mappings
 */
export async function getAllAgencyMappings(): Promise<AgencyNameMapping[]> {
  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, created_at')
      .order('name');

    if (error) {
      console.error('Error fetching all agencies:', error);
      return [];
    }

    // Update cache
    data.forEach(agency => {
      agencyNameCache.set(agency.id, agency.name);
      reverseAgencyNameCache.set(agency.name.toLowerCase(), agency.id);
    });
    cacheLastUpdated = new Date();

    return data.map(agency => ({
      agencyId: agency.id,
      agencyName: agency.name,
      isActive: true,
      lastSynced: new Date()
    }));
  } catch (error) {
    console.error('Error in getAllAgencyMappings:', error);
    return [];
  }
}

/**
 * Get agency name for current user by looking up in profiles table
 */
export async function getCurrentUserAgencyName(agencyId?: string): Promise<string | null> {
  if (!agencyId) {
    return null;
  }
  
  try {
    console.log(`Looking up agency name for agency_id: ${agencyId} in profiles table`);
    
    // Query profiles table to find agency_name for the given agency_id
    const { data, error } = await supabase
      .from('profiles')
      .select('agency_name')
      .eq('agency_id', agencyId)
      .not('agency_name', 'is', null)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching agency name from profiles:', error);
      // Fall back to the old method if profiles lookup fails
      console.log('Falling back to agencies table lookup');
      return await getAgencyNameById(agencyId);
    }

    if (!data || !data.agency_name) {
      console.log(`No agency_name found in profiles for agency_id: ${agencyId}`);
      // Fall back to the old method if no agency_name in profiles
      return await getAgencyNameById(agencyId);
    }

    console.log(`Found agency name in profiles: ${data.agency_name}`);
    return data.agency_name;
  } catch (error) {
    console.error('Error in getCurrentUserAgencyName:', error);
    // Fall back to the old method on error
    return await getAgencyNameById(agencyId);
  }
}

/**
 * Validate and normalize agency name for external data filtering
 */
export function normalizeAgencyName(agencyName: string): string {
  return agencyName.trim().toLowerCase();
}

/**
 * Check if agency name exists in the system
 */
export async function validateAgencyName(agencyName: string): Promise<boolean> {
  const agencyId = await getAgencyIdByName(agencyName);
  return agencyId !== null;
}

/**
 * Get distinct agency names from external tables (for debugging/validation)
 */
export async function getExternalAgencyNames(): Promise<{
  salesTargets: string[];
  invoices: string[];
}> {
  try {
    const [salesTargetsResult, invoicesResult] = await Promise.all([
      supabase
        .from('external_sales_targets')
        .select('customer_name')
        .not('customer_name', 'is', null),
      supabase
        .from('external_invoices')
        .select('partner_name')
        .not('partner_name', 'is', null)
    ]);

    const salesTargets = salesTargetsResult.data 
      ? [...new Set(salesTargetsResult.data.map(item => item.customer_name))]
      : [];
      
    const invoices = invoicesResult.data 
      ? [...new Set(invoicesResult.data.map(item => item.partner_name))]
      : [];

    return { salesTargets, invoices };
  } catch (error) {
    console.error('Error fetching external agency names:', error);
    return { salesTargets: [], invoices: [] };
  }
}

/**
 * Clear the agency name cache
 */
export function clearAgencyCache(): void {
  agencyNameCache.clear();
  reverseAgencyNameCache.clear();
  cacheLastUpdated = null;
}

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cacheLastUpdated) {
    return false;
  }
  
  const now = new Date();
  const timeDiff = now.getTime() - cacheLastUpdated.getTime();
  return timeDiff < CACHE_DURATION;
}

/**
 * Preload agency mappings into cache
 */
export async function preloadAgencyMappings(): Promise<void> {
  await getAllAgencyMappings();
}