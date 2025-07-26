// External data service for accessing external database tables
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase, isExternalClientConfigured } from '@/integrations/supabase/external-client';

// Types for external data (matching local external tables schema)
export interface ExternalSalesTarget {
  id: string;
  customer_name: string; // This matches agency names
  target_year: number;
  target_months: string; // e.g., "Q1", "Jan-Mar", etc.
  base_year?: number | null;
  target_data?: any | null; // JSON data containing category breakdowns
  initial_total_value?: number;
  adjusted_total_value?: number;
  percentage_increase?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  // Additional fields that might exist in your external sales_targets table
  [key: string]: any;
}

export interface ExternalInvoice {
  id: string;
  name?: string | null;
  partner_name: string; // This matches agency names
  date_order?: string;
  amount_total?: number;
  state?: string | null;
  order_lines?: any; // JSON data containing product categories
  // Additional fields that might exist in your external invoices table
  [key: string]: any;
}

export interface ExternalDataFilters {
  agencyName?: string;  // Deprecated: use userName instead
  userName?: string;
  year?: number;
  quarter?: string;
  startDate?: string;
  endDate?: string;
}

export class ExternalDataService {
  private static instance: ExternalDataService;

  public static getInstance(): ExternalDataService {
    if (!ExternalDataService.instance) {
      ExternalDataService.instance = new ExternalDataService();
    }
    return ExternalDataService.instance;
  }

  private constructor() {}

  /**
   * Check if external data service is available
   */
  public isAvailable(): boolean {
    return isExternalClientConfigured();
  }

  /**
   * Find matching external customer name for a given user name
   */
  private async findMatchingExternalCustomerName(userName: string): Promise<string | null> {
    try {
      // First try exact match
      const { data: exactMatch } = await externalSupabase
        .from('sales_targets')
        .select('customer_name')
        .eq('customer_name', userName)
        .limit(1);

      if (exactMatch && exactMatch.length > 0) {
        console.log(`Exact match found: "${userName}"`);
        return userName;
      }

      // Get all unique customer names for fuzzy matching
      const { data: allCustomers } = await externalSupabase
        .from('sales_targets')
        .select('customer_name')
        .not('customer_name', 'is', null);

      const uniqueCustomers = [...new Set(allCustomers?.map(c => c.customer_name) || [])];
      
      // Try fuzzy matching
      const normalizedUser = userName.toLowerCase().trim();
      
      // Look for partial matches
      const fuzzyMatch = uniqueCustomers.find(customerName => {
        const normalizedCustomer = customerName.toLowerCase().trim();
        
        // Check if user name is contained in customer name or vice versa
        if (normalizedCustomer.includes(normalizedUser) || 
            normalizedUser.includes(normalizedCustomer) ||
            normalizedCustomer.startsWith(normalizedUser) ||
            normalizedUser.startsWith(normalizedCustomer)) {
          return true;
        }
        
        // Handle word order differences
        const userWords = normalizedUser.split(/\s+/);
        const customerWords = normalizedCustomer.split(/[\s\-]+/);
        
        // Check if all words from user exist in customer (in any order)
        const allUserWordsFound = userWords.every(word => 
          customerWords.some(customerWord => 
            customerWord.includes(word) || word.includes(customerWord)
          )
        );
        
        // Check if all words from customer exist in user (in any order)
        const allCustomerWordsFound = customerWords.every(word => 
          userWords.some(userWord => 
            userWord.includes(word) || word.includes(userWord)
          )
        );
        
        return allUserWordsFound && userWords.length >= 2 && customerWords.length >= 2;
      });

      if (fuzzyMatch) {
        console.log(`Fuzzy match found: "${userName}" -> "${fuzzyMatch}"`);
        return fuzzyMatch;
      }

      console.log(`No match found for user: "${userName}"`);
      return null;
    } catch (error) {
      console.error('Error finding matching external customer name:', error);
      return null;
    }
  }

  /**
   * Fetch sales targets from external project
   */
  public async getSalesTargets(filters: ExternalDataFilters = {}): Promise<{
    data: ExternalSalesTarget[];
    error: string | null;
  }> {
    try {
      if (!this.isAvailable()) {
        return {
          data: [],
          error: 'External data service not configured'
        };
      }

      console.log('🎯 Fetching external sales targets with filters:', filters);

      let query = externalSupabase
        .from('sales_targets')
        .select('*');

      // Apply filters with fuzzy matching for user names
      const searchName = filters.userName || filters.agencyName; // Support both for backward compatibility
      if (searchName) {
        console.log(`🔍 Looking for external match for user: "${searchName}"`);
        const matchingCustomerName = await this.findMatchingExternalCustomerName(searchName);
        if (matchingCustomerName) {
          console.log(`✅ Found external match: "${searchName}" -> "${matchingCustomerName}"`);
          query = query.eq('customer_name', matchingCustomerName);
        } else {
          // No match found, return empty results
          console.log(`❌ No external customer match found for: "${searchName}"`);
          return {
            data: [],
            error: null
          };
        }
      } else {
        console.log('⚠️ No user name provided in filters, fetching all targets');
      }

      if (filters.year) {
        query = query.eq('target_year', filters.year);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching external sales targets:', error);
        return {
          data: [],
          error: error.message
        };
      }

      console.log(`Fetched ${data?.length || 0} external sales targets`);

      return {
        data: data || [],
        error: null
      };
    } catch (error) {
      console.error('Exception in getSalesTargets:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch invoices from external project
   */
  public async getInvoices(filters: ExternalDataFilters = {}): Promise<{
    data: ExternalInvoice[];
    error: string | null;
  }> {
    try {
      if (!this.isAvailable()) {
        return {
          data: [],
          error: 'External data service not configured'
        };
      }

      console.log('🧾 Fetching external invoices with filters:', filters);

      let query = externalSupabase
        .from('invoices')
        .select('*');

      // Apply filters with fuzzy matching for user names
      const searchName = filters.userName || filters.agencyName; // Support both for backward compatibility
      if (searchName) {
        const matchingCustomerName = await this.findMatchingExternalCustomerName(searchName);
        if (matchingCustomerName) {
          query = query.eq('partner_name', matchingCustomerName);
        } else {
          // No match found, return empty results
          console.log(`No external customer match found for invoices: "${searchName}"`);
          return {
            data: [],
            error: null
          };
        }
      }

      // Only apply date filters if we know the date column exists
      if (filters.startDate || filters.endDate) {
        try {
          if (filters.startDate) {
            query = query.gte('date_order', filters.startDate);
          }
          if (filters.endDate) {
            query = query.lte('date_order', filters.endDate);
          }
        } catch (error) {
          console.warn('Date filtering not supported, skipping date filters');
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching external invoices:', error);
        return {
          data: [],
          error: error.message
        };
      }

      console.log(`🧾 Fetched ${data?.length || 0} external invoices for date range ${filters.startDate} to ${filters.endDate}`);
      
      // Log some sample invoice dates for debugging
      if (data && data.length > 0) {
        console.log('📋 Sample invoice dates:', data.slice(0, 3).map(inv => ({ 
          id: inv.id, 
          date_order: inv.date_order, 
          amount_total: inv.amount_total 
        })));
      }

      return {
        data: data || [],
        error: null
      };
    } catch (error) {
      console.error('Exception in getInvoices:', error);
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse month numbers from target_months string
   * Handles formats like "07,08,09", "1,2,3", "Jan,Feb,Mar", "Q1", etc.
   */
  public parseTargetMonths(targetMonths: string | string[] | null | undefined): number[] {
    const months: number[] = [];
    
    // Handle null or undefined
    if (!targetMonths) {
      console.warn('Invalid targetMonths value:', targetMonths);
      return months; // Return empty array
    }
    
    // Handle array format (like ['07', '08', '09'])
    if (Array.isArray(targetMonths)) {
      console.log('📅 Parsing targetMonths array:', targetMonths);
      for (const monthStr of targetMonths) {
        const monthNum = parseInt(monthStr.toString());
        if (monthNum >= 1 && monthNum <= 12) {
          months.push(monthNum);
        }
      }
      console.log('📅 Parsed months from array:', months);
      return months;
    }
    
    // Handle non-string values
    if (typeof targetMonths !== 'string') {
      console.warn('Invalid targetMonths value (not string or array):', targetMonths);
      return months; // Return empty array
    }
    
    const normalizedTargetMonths = targetMonths.trim();
    if (!normalizedTargetMonths) {
      console.warn('Empty targetMonths string');
      return months;
    }
    
    // Handle comma-separated month numbers like "07,08,09"
    if (normalizedTargetMonths.includes(',')) {
      const monthStrings = normalizedTargetMonths.split(',').map(m => m.trim());
      for (const monthStr of monthStrings) {
        const monthNum = parseInt(monthStr);
        if (monthNum >= 1 && monthNum <= 12) {
          months.push(monthNum);
        }
      }
    }
    // Handle quarter notation
    else if (normalizedTargetMonths.includes('Q1')) {
      months.push(1, 2, 3);
    } else if (normalizedTargetMonths.includes('Q2')) {
      months.push(4, 5, 6);
    } else if (normalizedTargetMonths.includes('Q3')) {
      months.push(7, 8, 9);
    } else if (normalizedTargetMonths.includes('Q4')) {
      months.push(10, 11, 12);
    }
    // Handle month names
    else if (normalizedTargetMonths.toLowerCase().includes('jan')) {
      months.push(1);
    } else if (normalizedTargetMonths.toLowerCase().includes('feb')) {
      months.push(2);
    } else if (normalizedTargetMonths.toLowerCase().includes('mar')) {
      months.push(3);
    } else if (normalizedTargetMonths.toLowerCase().includes('apr')) {
      months.push(4);
    } else if (normalizedTargetMonths.toLowerCase().includes('may')) {
      months.push(5);
    } else if (normalizedTargetMonths.toLowerCase().includes('jun')) {
      months.push(6);
    } else if (normalizedTargetMonths.toLowerCase().includes('jul')) {
      months.push(7);
    } else if (normalizedTargetMonths.toLowerCase().includes('aug')) {
      months.push(8);
    } else if (normalizedTargetMonths.toLowerCase().includes('sep')) {
      months.push(9);
    } else if (normalizedTargetMonths.toLowerCase().includes('oct')) {
      months.push(10);
    } else if (normalizedTargetMonths.toLowerCase().includes('nov')) {
      months.push(11);
    } else if (normalizedTargetMonths.toLowerCase().includes('dec')) {
      months.push(12);
    }

    return months;
  }

  /**
   * Convert month numbers to quarter
   */
  public monthsToQuarter(months: number[]): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
    if (months.length === 0) return 'Q1';
    
    // Get the first month to determine quarter
    const firstMonth = Math.min(...months);
    
    if (firstMonth <= 3) return 'Q1';
    if (firstMonth <= 6) return 'Q2';
    if (firstMonth <= 9) return 'Q3';
    return 'Q4';
  }

  /**
   * Get category breakdown from target data
   */
  public getTargetCategories(targetData: any): Array<{category: string, target: number}> {
    const categories: Array<{category: string, target: number}> = [];
    
    try {
      if (targetData && typeof targetData === 'object') {
        // Handle different possible structures for category data
        
        // Option 1: Direct categories array
        if (targetData.categories && Array.isArray(targetData.categories)) {
          targetData.categories.forEach((cat: any) => {
            if (cat.category && (cat.target || cat.amount)) {
              categories.push({
                category: cat.category,
                target: Number(cat.target || cat.amount)
              });
            }
          });
        }
        
        // Option 2: product_category field
        if (targetData.product_category) {
          if (Array.isArray(targetData.product_category)) {
            targetData.product_category.forEach((cat: any) => {
              if (cat.category && (cat.target || cat.amount)) {
                categories.push({
                  category: cat.category,
                  target: Number(cat.target || cat.amount)
                });
              }
            });
          } else if (typeof targetData.product_category === 'object') {
            // Single category object
            if (targetData.product_category.category && (targetData.product_category.target || targetData.product_category.amount)) {
              categories.push({
                category: targetData.product_category.category,
                target: Number(targetData.product_category.target || targetData.product_category.amount)
              });
            }
          }
        }
        
        // Option 3: Direct category keys as properties
        Object.keys(targetData).forEach(key => {
          if (key.toLowerCase().includes('category') && targetData[key]) {
            const categoryData = targetData[key];
            if (typeof categoryData === 'object' && (categoryData.target || categoryData.amount)) {
              categories.push({
                category: categoryData.name || key,
                target: Number(categoryData.target || categoryData.amount)
              });
            } else if (typeof categoryData === 'number') {
              // Direct number value
              categories.push({
                category: key,
                target: Number(categoryData)
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error parsing target categories:', error);
    }
    
    console.log('📋 Extracted target categories:', categories);
    return categories;
  }

  /**
   * Calculate category-wise achievement from invoices
   */
  public async calculateCategoryAchievement(
    userName: string,
    targetMonths: string | string[],
    year: number,
    categories: string[]
  ): Promise<Array<{category: string, achieved: number}>> {
    try {
      if (!this.isAvailable()) {
        console.log('External data service not available for category achievement calculation');
        return [];
      }

      console.log(`🎯 Calculating category achievement for ${userName}, categories: ${categories.join(', ')}`);

      // Parse target months to get actual month numbers
      const months = this.parseTargetMonths(targetMonths);
      
      let startDate: string;
      let endDate: string;
      
      if (months.length === 0) {
        console.log('⚠️ No valid months found in target_months, defaulting to full year');
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      } else {
        // Calculate date range based on actual months
        const minMonth = Math.min(...months);
        const maxMonth = Math.max(...months);
        
        startDate = `${year}-${minMonth.toString().padStart(2, '0')}-01`;
        endDate = new Date(year, maxMonth, 0).toISOString().split('T')[0]; // Last day of max month
        
        console.log(`📆 Date range for category achievement: ${startDate} to ${endDate}`);
      }

      const { data: invoices, error } = await this.getInvoices({
        userName,
        startDate,
        endDate
      });

      if (error) {
        console.error('Error getting invoices for category achievement calculation:', error);
        return [];
      }

      // Process invoices to extract category achievements
      const categoryAchievements: Array<{category: string, achieved: number}> = [];
      
      categories.forEach(category => {
        let categoryTotal = 0;
        
        invoices.forEach(invoice => {
          try {
            // Parse order_lines to find products in this category
            if (invoice.order_lines) {
              let orderLines = invoice.order_lines;
              
              // Handle if order_lines is a string (JSON)
              if (typeof orderLines === 'string') {
                orderLines = JSON.parse(orderLines);
              }
              
              // Handle array of order lines
              if (Array.isArray(orderLines)) {
                orderLines.forEach((line: any) => {
                  if (line.product_category === category) {
                    categoryTotal += Number(line.price_total || line.subtotal || line.total_amount || line.amount || 0);
                  }
                });
              } else if (typeof orderLines === 'object') {
                // Single order line object or object with category breakdown
                if (orderLines.product_category === category) {
                  categoryTotal += Number(orderLines.price_total || orderLines.subtotal || orderLines.total_amount || orderLines.amount || 0);
                }
                
                // Also check if it's a category breakdown object
                if (orderLines[category]) {
                  categoryTotal += Number(orderLines[category]);
                }
              }
            }
          } catch (error) {
            console.error('Error parsing order_lines for invoice:', invoice.id, error);
          }
        });
        
        categoryAchievements.push({
          category: category,
          achieved: categoryTotal
        });
        
        console.log(`📊 Category ${category}: Rs ${categoryTotal.toLocaleString()}`);
      });

      return categoryAchievements;
    } catch (error) {
      console.error('Error calculating category achievement:', error);
      return [];
    }
  }

  /**
   * Calculate achievement for external targets based on external invoices
   */
  public async calculateExternalAchievement(
    userName: string,
    targetMonths: string,
    year: number
  ): Promise<number> {
    try {
      if (!this.isAvailable()) {
        console.log('External data service not available for achievement calculation');
        return 0;
      }

      console.log(`🎯 Calculating external achievement for ${userName}, target_months: "${targetMonths}" for year ${year}`);

      // Parse target months to get actual month numbers
      const months = this.parseTargetMonths(targetMonths);
      console.log(`📅 Parsed months from "${targetMonths}":`, months);
      
      let startDate: string;
      let endDate: string;
      
      if (months.length === 0) {
        console.log('⚠️ No valid months found in target_months, defaulting to full year');
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      } else {
        // Calculate date range based on actual months
        const minMonth = Math.min(...months);
        const maxMonth = Math.max(...months);
        
        startDate = `${year}-${minMonth.toString().padStart(2, '0')}-01`;
        endDate = new Date(year, maxMonth, 0).toISOString().split('T')[0]; // Last day of max month
        
        console.log(`📆 Target covers months ${months.join(',')} (${minMonth} to ${maxMonth})`);
        console.log(`📆 Date range for achievement calculation: ${startDate} to ${endDate}`);
      }

      const { data: invoices, error } = await this.getInvoices({
        userName,
        startDate,
        endDate
      });

      if (error) {
        console.error('Error getting invoices for achievement calculation:', error);
        return 0;
      }

      // Sum up the total amounts
      const totalAchieved = invoices.reduce((sum, invoice) => {
        return sum + Number(invoice.amount_total);
      }, 0);

      console.log(`💰 External achievement calculated: Rs ${totalAchieved.toLocaleString()} from ${invoices.length} invoices`);
      console.log(`📊 Target period: ${targetMonths} (months: ${months.join(',')}) - Achievement period: ${startDate} to ${endDate}`);

      return totalAchieved;
    } catch (error) {
      console.error('Error calculating external achievement:', error);
      return 0;
    }
  }

  /**
   * Get complete category breakdown for a target (both targets and achievements)
   */
  public async getCategoryBreakdown(
    target: ExternalSalesTarget
  ): Promise<Array<{category: string, target: number, achieved: number, percentage: number}>> {
    try {
      console.log('🔍 Getting category breakdown for target:', target.id);
      
      // Extract categories from target data
      const targetCategories = this.getTargetCategories(target.target_data);
      
      if (targetCategories.length === 0) {
        console.log('⚠️ No categories found in target data, returning empty breakdown');
        return [];
      }
      
      // Get category names for achievement calculation
      const categoryNames = targetCategories.map(cat => cat.category);
      
      // Calculate achievements for each category
      const categoryAchievements = await this.calculateCategoryAchievement(
        target.customer_name,
        target.target_months,
        target.target_year,
        categoryNames
      );
      
      // Combine target and achievement data
      const breakdown = targetCategories.map(targetCat => {
        const achievementData = categoryAchievements.find(ach => ach.category === targetCat.category);
        const achieved = achievementData ? achievementData.achieved : 0;
        const totalTarget = target.adjusted_total_value || target.initial_total_value;
        const percentage = totalTarget > 0 ? (targetCat.target / totalTarget) * 100 : 0;
        
        return {
          category: targetCat.category,
          target: targetCat.target,
          achieved: achieved,
          percentage: percentage
        };
      });
      
      console.log('📊 Category breakdown result:', breakdown);
      return breakdown;
      
    } catch (error) {
      console.error('Error getting category breakdown:', error);
      return [];
    }
  }

  /**
   * Get available agency names from external data
   */
  public async getAvailableAgencyNames(): Promise<{
    salesTargetAgencies: string[];
    invoiceAgencies: string[];
    error: string | null;
  }> {
    try {
      if (!this.isAvailable()) {
        return {
          salesTargetAgencies: [],
          invoiceAgencies: [],
          error: 'External data service not configured'
        };
      }

      const [targetsResult, invoicesResult] = await Promise.all([
        externalSupabase
          .from('sales_targets')
          .select('customer_name')
          .not('customer_name', 'is', null),
        externalSupabase
          .from('invoices')
          .select('partner_name')
          .not('partner_name', 'is', null)
      ]);

      const salesTargetAgencies = targetsResult.data
        ? [...new Set(targetsResult.data.map(item => item.customer_name))]
        : [];

      const invoiceAgencies = invoicesResult.data
        ? [...new Set(invoicesResult.data.map(item => item.partner_name))]
        : [];

      return {
        salesTargetAgencies,
        invoiceAgencies,
        error: null
      };
    } catch (error) {
      console.error('Error getting available agency names:', error);
      return {
        salesTargetAgencies: [],
        invoiceAgencies: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test connection to external database
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    stats?: {
      targetsCount: number;
      invoicesCount: number;
    };
  }> {
    try {
      if (!this.isAvailable()) {
        return {
          success: false,
          message: 'External data service not available.'
        };
      }

      // Test queries to both tables
      const [targetsResult, invoicesResult] = await Promise.all([
        externalSupabase.from('sales_targets').select('*', { count: 'exact', head: true }),
        externalSupabase.from('invoices').select('*', { count: 'exact', head: true })
      ]);

      if (targetsResult.error || invoicesResult.error) {
        return {
          success: false,
          message: `Connection test failed: ${targetsResult.error?.message || invoicesResult.error?.message}`
        };
      }

      return {
        success: true,
        message: 'External database connection successful',
        stats: {
          targetsCount: targetsResult.count || 0,
          invoicesCount: invoicesResult.count || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const externalDataService = ExternalDataService.getInstance();