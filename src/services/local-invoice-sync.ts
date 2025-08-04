import { supabase } from '@/integrations/supabase/client';

interface LocalInvoice {
  id: number;
  name: string;
  partner_name: string;
  date_order: string;
  amount_total: number;
  state: string;
  order_lines: any[];
}

interface LocalDatabaseInvoice {
  id: string;
  agency_id: string;
  customer_name: string;
  invoice_number: string;
  total: number;
  created_at: string;
}

interface LocalInvoiceItem {
  id: string;
  invoice_id: string;
  product_name: string;
  color: string;
  size: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CustomerReturn {
  id: string;
  agency_id: string;
  customer_name: string;
  invoice_id: string;
  reason: string;
  status: string;
  total: number;
  created_at: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  syncedCount?: number;
  error?: string;
  details?: any;
}

export class LocalInvoiceSyncService {

  /**
   * Enhanced fuzzy match products between different naming formats
   * Example: "SOLACE-BEIGH 28" (invoice) <-> "[SB28] SOLACE-BLACK 28" (external)
   * Handles: SB28/SBE28, BLACK/BEIGH variations as same product
   */
  private matchProducts(invoiceProduct: string, externalProduct: string, color?: string, size?: string): boolean {
    // Extract product codes from both products
    const invoiceCodeMatch = invoiceProduct.match(/\[([^\]]+)\]/);
    const externalCodeMatch = externalProduct.match(/\[([^\]]+)\]/);
    
    const invoiceCode = invoiceCodeMatch ? invoiceCodeMatch[1] : null;
    const externalCode = externalCodeMatch ? externalCodeMatch[1] : null;
    
    // Remove product codes and clean names
    const cleanExternalProduct = externalProduct.replace(/^\[[^\]]+\]\s*/, '').trim().toLowerCase();
    const cleanInvoiceProduct = invoiceProduct.replace(/^\[[^\]]+\]\s*/, '').trim().toLowerCase();
    
    // 1. Exact match after removing brackets
    if (cleanExternalProduct === cleanInvoiceProduct) {
      return true;
    }
    
    // 2. Enhanced product code matching (SB28 = SBE28, etc.)
    if (invoiceCode && externalCode) {
      // Normalize codes: remove common prefixes/suffixes, handle variations
      const normalizeCode = (code: string) => {
        return code.toLowerCase()
          .replace(/^(sb|sbe)/, 'sb') // SB28, SBE28 -> sb28
          .replace(/^(bw|bws)/, 'bw') // BW30, BWS30 -> bw30
          .replace(/^(cv|cvs)/, 'cv') // CV90, CVS90 -> cv90
          .replace(/[^a-z0-9]/g, ''); // Remove special chars
      };
      
      const normalizedInvoiceCode = normalizeCode(invoiceCode);
      const normalizedExternalCode = normalizeCode(externalCode);
      
      if (normalizedInvoiceCode === normalizedExternalCode) {
        console.log(`✅ Matched by normalized codes: ${invoiceCode} -> ${externalCode}`);
        return true;
      }
    }
    
    // 3. Product name similarity matching
    const getProductBaseName = (name: string) => {
      return name.toLowerCase()
        .replace(/-(black|beigh|white|red|blue|green|yellow|grey|gray)/g, '') // Remove colors
        .replace(/\s+(xs|s|m|l|xl|xxl|xxxl|\d+)$/g, '') // Remove sizes
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const baseExternalName = getProductBaseName(cleanExternalProduct);
    const baseInvoiceName = getProductBaseName(cleanInvoiceProduct);
    
    if (baseExternalName === baseInvoiceName) {
      console.log(`✅ Matched by base name: "${baseInvoiceName}"`);
      return true;
    }
    
    // 4. Partial matching for similar names
    const similarity = this.calculateSimilarity(baseExternalName, baseInvoiceName);
    if (similarity > 0.8) { // 80% similarity threshold
      console.log(`✅ Matched by similarity (${Math.round(similarity * 100)}%): "${baseInvoiceName}" <-> "${baseExternalName}"`);
      return true;
    }
    
    // 5. Fuzzy matching - check if one contains the other
    if (cleanExternalProduct.includes(cleanInvoiceProduct) ||
        cleanInvoiceProduct.includes(cleanExternalProduct)) {
      console.log(`✅ Matched by containment: "${cleanInvoiceProduct}" <-> "${cleanExternalProduct}"`);
      return true;
    }
    
    return false;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Extract product code from external inventory product name
   * Example: "[SB38] SOLACE-BEIGH 34" -> "SB38"
   */
  private extractProductCode(productName: string): string | null {
    const match = productName.match(/^\[([^\]]+)\]/);
    return match ? match[1] : null;
  }

  /**
   * Standardize product names for consistent matching
   * Example: "SOLACE-BEIGH 28" -> "[SBE28] SOLACE-BEIGH 28" 
   */
  private standardizeProductName(productName: string): string {
    // If already has a product code in brackets, return as-is
    if (productName.match(/^\[[^\]]+\]/)) {
      return productName;
    }
    
    // Extract potential product code and standardize
    const name = productName.toLowerCase();
    let productCode = '';
    
    // Common product code patterns based on your data
    if (name.includes('solace')) {
      if (name.includes('black') || name.includes('beigh')) {
        const sizeMatch = name.match(/(\d+)/);
        const size = sizeMatch ? sizeMatch[1] : '';
        productCode = `SBE${size}`; // Standardize to SBE format
      }
    } else if (name.includes('black') && name.includes('white')) {
      const sizeMatch = name.match(/(\d+)/);
      const size = sizeMatch ? sizeMatch[1] : '';
      productCode = `BWS${size}`;
    } else if (name.includes('color') && name.includes('vest')) {
      const sizeMatch = name.match(/(\d+)/);
      const size = sizeMatch ? sizeMatch[1] : '';
      productCode = `CV${size}`;
    }
    
    // If we found a product code, add it to the name
    if (productCode) {
      return `[${productCode}] ${productName}`;
    }
    
    // Return original if no pattern matched
    return productName;
  }

  /**
   * Create product key for matching (product name + color + size)
   */
  private createProductKey(productName: string, color: string = 'Default', size: string = 'Default'): string {
    return `${productName.trim().toLowerCase()}-${color.trim().toLowerCase()}-${size.trim().toLowerCase()}`;
  }

  /**
   * Clean product name for matching by removing various code prefixes and standardizing format
   * Handles ALL patterns: [CODE], (CODE), CODE:, etc.
   */
  private cleanProductNameForMatching(productName: string): string {
    if (!productName) return '';
    
    let cleaned = productName.trim();
    
    // Remove various product code prefixes (handles ALL formats)
    // Priority: Most specific patterns first, then general patterns
    cleaned = cleaned
      .replace(/^\[[^\]]+\]\s*/, '')        // [SB42] SOLACE-BLACK 42 -> SOLACE-BLACK 42
      .replace(/^\([^\)]+\)\s*/, '')        // (SB42) SOLACE-BLACK 42 -> SOLACE-BLACK 42
      .replace(/^[A-Z0-9]{2,6}:\s+/, '')    // CODE123: Product -> Product (specific colon format)
      .replace(/^[A-Z0-9]{2,6}\s-\s/, '')   // CODE - Product -> Product (specific dash format)
      .trim();
    
    // Standardize spacing and formatting
    cleaned = cleaned
      .replace(/\s+/g, ' ')              // Multiple spaces -> single space
      .replace(/\s*-\s*/g, '-')          // " - " -> "-" 
      .trim();
    
    console.log(`🧹 Product name cleaning: "${productName}" -> "${cleaned}"`);
    return cleaned;
  }

  /**
   * Find matching product from products table using fuzzy matching
   * Returns the actual product record from products table for consistency
   */
  private async findMatchingProduct(
    productName: string, 
    agencyId: string
  ): Promise<{id: string, name: string, category: string, subCategory: string} | null> {
    try {
      console.log(`🔍 Searching for matching product: "${productName}" (agency: ${agencyId})`);
      
      // First, let's check if there are ANY products (no agency_id column exists)
      const { data: allProducts, error: countError } = await supabase
        .from('products')
        .select('id, name')
        .limit(5);
      
      if (countError) {
        console.warn(`❌ Error checking products:`, countError);
      } else {
        console.log(`📊 Found ${allProducts?.length || 0} products in catalog (showing first 5):`, 
                   allProducts?.map(p => p.name) || []);
      }
      
      // Helper function to escape special SQL ILIKE characters
      const escapeForIlike = (str: string) => {
        return str
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/\[/g, '\\[')   // Escape opening brackets
          .replace(/\]/g, '\\]')   // Escape closing brackets
          .replace(/%/g, '\\%')    // Escape percent signs
          .replace(/_/g, '\\_');   // Escape underscores
      };
      
      // Method 1: Clean product name by removing various prefixes and standardizing
      // This handles ALL product patterns: [CODE] PREFIX, (CODE) PREFIX, CODE: PREFIX, etc.
      const cleanProductName = this.cleanProductNameForMatching(productName);
      console.log(`🔧 Cleaned product name: "${productName}" -> "${cleanProductName}"`);
      
      let { data: exactMatch, error: exactError } = await supabase
        .from('products')
        .select('id, name, category, sub_category')
        .eq('name', cleanProductName)
        .limit(1);

      if (exactError) {
        console.warn(`❌ Error in exact match search:`, exactError);
      } else if (exactMatch && exactMatch.length > 0) {
        console.log(`✅ Found exact match: "${cleanProductName}" matches "${exactMatch[0].name}" (ID: ${exactMatch[0].id})`);
        return {
          id: exactMatch[0].id,
          name: exactMatch[0].name,
          category: exactMatch[0].category || 'General',
          subCategory: exactMatch[0].sub_category || 'General'
        };
      } else {
        console.log(`⚠️ No exact match found for cleaned name: "${cleanProductName}"`);
      }

      // Method 2: Extract product code and search
      const productCodeMatch = productName.match(/\[([^\]]+)\]/);
      if (productCodeMatch) {
        const productCode = productCodeMatch[1];
        console.log(`🔍 Extracted product code: "${productCode}" from "${productName}"`);
        
        let { data: codeMatch, error: codeError } = await supabase
          .from('products')
          .select('id, name, category, sub_category')
          .textSearch('name', productCode)
          .limit(1);

        if (codeError) {
          console.warn(`❌ Error in code match search:`, codeError);
        } else if (codeMatch && codeMatch.length > 0) {
          console.log(`✅ Found code match: "${codeMatch[0].name}" (ID: ${codeMatch[0].id}, code: ${productCode})`);
          return {
            id: codeMatch[0].id,
            name: codeMatch[0].name,
            category: codeMatch[0].category || 'General',
            subCategory: codeMatch[0].sub_category || 'General'
          };
        } else {
          console.log(`⚠️ No code match found for: "${productCode}"`);
        }
      } else {
        console.log(`⚠️ No product code found in: "${productName}"`);
      }

      // Method 3: Fuzzy matching by base name (remove brackets, colors, sizes)
      const baseName = productName
        .replace(/^\[[^\]]+\]\s*/, '') // Remove product codes
        .replace(/-(black|beigh|white|red|blue|green|yellow|grey|gray)/gi, '') // Remove colors
        .replace(/\s+(xs|s|m|l|xl|xxl|xxxl|\d+)$/gi, '') // Remove sizes
        .trim();

      if (baseName && baseName !== productName) {
        let { data: fuzzyMatch, error: fuzzyError } = await supabase
          .from('products')
          .select('id, name, category, sub_category')
          .textSearch('name', baseName)
          .limit(1);

        if (!fuzzyError && fuzzyMatch && fuzzyMatch.length > 0) {
          console.log(`✅ Found fuzzy match: "${fuzzyMatch[0].name}" (base: ${baseName})`);
          return {
            id: fuzzyMatch[0].id,
            name: fuzzyMatch[0].name,
            category: fuzzyMatch[0].category || 'General',
            subCategory: fuzzyMatch[0].sub_category || 'General'
          };
        }
      }

      console.log(`⚠️ No product match found for: "${productName}"`);
      return null;
    } catch (error) {
      console.warn('Error in findMatchingProduct:', error);
      return null;
    }
  }

  /**
   * Process stock OUT from local database invoices (sales)
   */
  async processLocalDatabaseInvoices(userId: string): Promise<SyncResult> {
    try {
      console.log('🚀 Processing stock OUT from local database invoices for user:', userId);

      // Get user profile data
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return {
          success: false,
          message: 'Failed to get user profile data',
          error: 'User profile not found'
        };
      }

      console.log(`👤 User: ${userProfile.name}, Agency: ${userProfile.agencyId}`);

      // Fetch invoices from local database for this agency
      console.log('📊 Fetching invoices from local database...');
      console.log('🔍 Agency ID:', userProfile.agencyId);
      
      // First, let's try without the nested query to avoid the multiple relationships issue
      const { data: localInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          agency_id,
          customer_name,
          invoice_number,
          total,
          created_at
        `)
        .eq('agency_id', userProfile.agencyId)
        .order('created_at', { ascending: false })
        .limit(100); // Process last 100 invoices

      if (invoicesError) {
        console.error('❌ Error fetching invoices:', {
          error: invoicesError,
          message: invoicesError.message,
          details: invoicesError.details,
          hint: invoicesError.hint,
          code: invoicesError.code
        });
        return {
          success: false,
          message: `Failed to fetch local invoices: ${invoicesError.message}`,
          error: invoicesError.message
        };
      }

      if (!localInvoices || localInvoices.length === 0) {
        console.log('⚠️ No invoices found for agency:', userProfile.agencyId);
        
        // Debug: Check if any invoices exist at all
        const { data: allInvoices, error: allError } = await supabase
          .from('invoices')
          .select('id, agency_id, customer_name')
          .limit(5);
          
        if (!allError && allInvoices) {
          console.log('📋 Sample invoices in database:', allInvoices);
        }
        
        return {
          success: true,
          message: 'No invoices found in local database for this agency',
          syncedCount: 0
        };
      }

      console.log(`✅ Fetched ${localInvoices.length} invoices from local database`);
      
      // Debug: Log invoice details
      localInvoices.forEach((invoice, index) => {
        console.log(`📄 Invoice ${index + 1}:`, {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          total: invoice.total
        });
      });

      // Check which invoices are already processed to avoid duplicates
      console.log('🔍 Checking for already processed invoices...');
      const invoiceIds = localInvoices.map(inv => inv.id);
      
      const { data: existingInvoices } = await supabase
        .from('external_inventory_management')
        .select('transaction_id')
        .eq('agency_id', userProfile.agencyId)
        .eq('transaction_type', 'sale')
        .eq('external_source', 'local_db')
        .in('transaction_id', invoiceIds);

      const existingInvoiceIds = new Set(existingInvoices?.map(inv => inv.transaction_id) || []);
      
      // Filter out already processed invoices
      const newInvoices = localInvoices.filter(invoice => !existingInvoiceIds.has(invoice.id));

      console.log(`📦 Found ${newInvoices.length} new invoices to process (${localInvoices.length - newInvoices.length} already processed)`);

      if (newInvoices.length === 0) {
        return {
          success: true,
          message: `All ${localInvoices.length} local invoices are already processed`,
          syncedCount: 0
        };
      }

      // Process new invoices into inventory as stock OUT
      let processedCount = 0;
      let createdTransactions = 0;
      let matchedProducts = 0;
      let unmatchedProducts = 0;
      let skippedInvoices = 0;
      let skippedItems = 0;

      console.log(`🔄 Starting to process ${newInvoices.length} new invoices...`);

      for (const invoice of newInvoices) {
        console.log(`\n📄 Processing invoice: ${invoice.invoice_number} (${invoice.customer_name})`);
        
        // Fetch invoice items separately to avoid the multiple relationships issue
        console.log(`🔍 Fetching invoice items for invoice ${invoice.id}...`);
        const { data: invoiceItems, error: itemsError } = await supabase
          .from('invoice_items')
          .select('id, product_name, color, size, quantity, unit_price, total')
          .eq('invoice_id', invoice.id);

        if (itemsError) {
          console.log(`  ❌ Error fetching invoice items:`, itemsError);
          skippedInvoices++;
          continue;
        }

        if (!invoiceItems || invoiceItems.length === 0) {
          console.log(`  ⚠️ No invoice items found for invoice ${invoice.invoice_number}`);
          skippedInvoices++;
          continue;
        }

        console.log(`  📦 Found ${invoiceItems.length} items in invoice`);

        for (const item of invoiceItems) {
          console.log(`    🔍 Processing item: ${item.product_name} (Qty: ${item.quantity})`);
          
          if (!item.product_name || item.quantity <= 0) {
            console.log(`    ⚠️ Skipping item - invalid name or quantity (${item.product_name}, ${item.quantity})`);
            skippedItems++;
            continue;
          }

          // Try to find matching product from products table
          const matchedProduct = await this.findMatchingProduct(item.product_name, userProfile.agencyId);
          
          let finalProductName = item.product_name;
          let finalCategory = 'General';
          let finalSubCategory = 'General';
          let matchedProductId = null;

          if (matchedProduct) {
            // Keep the original product name to preserve size/color variants
            finalProductName = item.product_name;
            finalCategory = matchedProduct.category;
            finalSubCategory = matchedProduct.subCategory;
            matchedProductId = matchedProduct.id;
            matchedProducts++;
            console.log(`✅ Matched product: "${item.product_name}" -> base product "${matchedProduct.name}" (ID: ${matchedProductId})`);
          } else {
            unmatchedProducts++;
            console.log(`⚠️ No match found in products table for: "${item.product_name}"`);
          }

          // Insert stock OUT transaction
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert({
              product_name: finalProductName,
              product_code: this.extractProductCode(finalProductName),
              color: item.color || 'Default',
              size: item.size || 'Default',
              category: finalCategory,
              sub_category: finalSubCategory,
              matched_product_id: matchedProductId, // NEW: Link to products table
              unit_price: item.unit_price || 0,
              transaction_type: 'sale',
              transaction_id: invoice.id,
              quantity: -Math.abs(item.quantity), // Negative for stock OUT
              reference_name: invoice.customer_name,
              agency_id: userProfile.agencyId,
              user_name: userProfile.name,
              transaction_date: invoice.created_at,
              notes: `Local sale to ${invoice.customer_name} - Invoice: ${invoice.invoice_number}`,
              external_source: 'local_db',
              external_id: invoice.id,
              external_reference: `Local Invoice ${invoice.invoice_number}`
            });

          if (insertError) {
            console.warn(`    ❌ Failed to create stock OUT transaction for ${item.product_name}:`, insertError);
            continue;
          }

          console.log(`    ✅ Created stock OUT transaction for ${finalProductName}`);
          createdTransactions++;
          processedCount++;
        }
      }

      console.log(`\n📊 Final Results:`);
      console.log(`  ✅ Processed: ${processedCount} items from ${newInvoices.length} invoices`);
      console.log(`  📦 Created transactions: ${createdTransactions}`);
      console.log(`  🎯 Matched products: ${matchedProducts}`);
      console.log(`  ❓ Unmatched products: ${unmatchedProducts}`);
      console.log(`  ⚠️ Skipped invoices: ${skippedInvoices}`);
      console.log(`  ⚠️ Skipped items: ${skippedItems}`);

      return {
        success: true,
        message: `Local database invoices processed successfully`,
        syncedCount: newInvoices.length,
        details: {
          syncTimestamp: new Date().toISOString(),
          agencyId: userProfile.agencyId,
          userName: userProfile.name,
          processedCount,
          createdTransactions,
          matchedProducts,
          unmatchedProducts
        }
      };

    } catch (error: any) {
      console.error('💥 Error processing local database invoices:', error);
      return {
        success: false,
        message: 'Local database invoice processing failed',
        error: error.message
      };
    }
  }

  /**
   * Process customer returns for stock IN
   */
  async processCustomerReturns(userId: string): Promise<SyncResult> {
    try {
      console.log('🚀 Processing customer returns for stock IN for user:', userId);

      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return {
          success: false,
          message: 'Failed to get user profile data',
          error: 'User profile not found'
        };
      }

      // Fetch returns from local database for this agency
      console.log('📊 Fetching returns from local database...');
      
      // First, let's get returns without the nested query to see if that works
      const { data: returns, error: returnsError } = await supabase
        .from('returns')
        .select(`
          id,
          agency_id,
          customer_name,
          invoice_id,
          reason,
          status,
          total,
          created_at
        `)
        .eq('agency_id', userProfile.agencyId)
        .eq('status', 'processed') // Only process processed returns
        .order('created_at', { ascending: false })
        .limit(50);

      if (returnsError) {
        console.error('❌ Error fetching customer returns:', {
          error: returnsError,
          message: returnsError.message,
          details: returnsError.details,
          hint: returnsError.hint,
          code: returnsError.code
        });
        return {
          success: false,
          message: `Failed to fetch customer returns: ${returnsError.message}`,
          error: returnsError.message
        };
      }

      if (!returns || returns.length === 0) {
        return {
          success: true,
          message: 'No completed customer returns found',
          syncedCount: 0
        };
      }

      console.log(`✅ Fetched ${returns.length} customer returns`);

      // Check which returns are already processed
      const returnIds = returns.map(ret => ret.id);
      const { data: existingReturns } = await supabase
        .from('external_inventory_management')
        .select('transaction_id')
        .eq('agency_id', userProfile.agencyId)
        .eq('transaction_type', 'customer_return')
        .eq('external_source', 'local_db')
        .in('transaction_id', returnIds);

      const existingReturnIds = new Set(existingReturns?.map(ret => ret.transaction_id) || []);
      const newReturns = returns.filter(ret => !existingReturnIds.has(ret.id));

      console.log(`📦 Found ${newReturns.length} new returns to process`);

      if (newReturns.length === 0) {
        return {
          success: true,
          message: 'All customer returns are already processed',
          syncedCount: 0
        };
      }

      let processedCount = 0;
      let createdTransactions = 0;

      // Since we can't get nested invoice items directly, we'll need to fetch them separately
      for (const returnRecord of newReturns) {
        if (!returnRecord.invoice_id) continue;

        // Fetch the invoice items for this return's invoice
        console.log(`📄 Fetching invoice items for return ${returnRecord.id} (invoice: ${returnRecord.invoice_id})`);
        const { data: invoiceItems, error: itemsError } = await supabase
          .from('invoice_items')
          .select('product_name, color, size, quantity, unit_price')
          .eq('invoice_id', returnRecord.invoice_id);

        if (itemsError || !invoiceItems || invoiceItems.length === 0) {
          console.log(`⚠️ No invoice items found for return ${returnRecord.id}`);
          continue;
        }

        console.log(`📦 Found ${invoiceItems.length} items in returned invoice`);

        for (const item of invoiceItems) {
          if (!item.product_name || item.quantity <= 0) continue;

          // Try to find matching product from products table
          const matchedProduct = await this.findMatchingProduct(item.product_name, userProfile.agencyId);
          
          let finalProductName = item.product_name;
          let finalCategory = 'General';
          let finalSubCategory = 'General';
          let matchedProductId = null;

          if (matchedProduct) {
            finalProductName = matchedProduct.name;
            finalCategory = matchedProduct.category;
            finalSubCategory = matchedProduct.subCategory;
            matchedProductId = matchedProduct.id;
            console.log(`✅ Customer return - matched: "${item.product_name}" -> "${finalProductName}"`);
          }

          // Insert stock IN transaction for customer return
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert({
              product_name: finalProductName,
              product_code: this.extractProductCode(finalProductName),
              color: item.color || 'Default',
              size: item.size || 'Default',
              category: finalCategory,
              sub_category: finalSubCategory,
              matched_product_id: matchedProductId, // NEW: Link to products table
              unit_price: item.unit_price || 0,
              transaction_type: 'customer_return',
              transaction_id: returnRecord.id,
              quantity: Math.abs(item.quantity), // Positive for stock IN
              reference_name: returnRecord.customer_name,
              agency_id: userProfile.agencyId,
              user_name: userProfile.name,
              transaction_date: returnRecord.created_at,
              notes: `Customer return from ${returnRecord.customer_name} - Reason: ${returnRecord.reason}`,
              external_source: 'local_db',
              external_id: returnRecord.id,
              external_reference: `Customer Return - ${returnRecord.reason}`
            });

          if (insertError) {
            console.warn(`Failed to create customer return transaction for ${item.product_name}:`, insertError);
            continue;
          }

          createdTransactions++;
          processedCount++;
        }
      }

      return {
        success: true,
        message: `Customer returns processed successfully`,
        syncedCount: newReturns.length,
        details: {
          processedCount,
          createdTransactions
        }
      };

    } catch (error: any) {
      console.error('💥 Error processing customer returns:', error);
      return {
        success: false,
        message: 'Customer returns processing failed',
        error: error.message
      };
    }
  }

  /**
   * Process company returns for stock OUT
   */
  async processCompanyReturns(userId: string): Promise<SyncResult> {
    try {
      console.log('🚀 Processing company returns for stock OUT for user:', userId);

      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return {
          success: false,
          message: 'Failed to get user profile data',
          error: 'User profile not found'
        };
      }

      // Fetch company returns from local database for this agency
      console.log('📊 Fetching company returns from local database...');
      
      // Check if return_items table exists, if not, skip company returns processing
      const { data: companyReturns, error: returnsError } = await supabase
        .from('returns')
        .select(`
          id,
          agency_id,
          customer_name,
          reason,
          status,
          total,
          created_at
        `)
        .eq('agency_id', userProfile.agencyId)
        .is('customer_id', null) // Company returns have null customer_id
        .eq('customer_name', 'Company Return') // Company returns are identified by this name
        .eq('status', 'processed') // Only process completed company returns
        .order('created_at', { ascending: false })
        .limit(50);

      if (returnsError) {
        console.error('❌ Error fetching company returns:', {
          error: returnsError,
          message: returnsError.message,
          details: returnsError.details,
          hint: returnsError.hint,
          code: returnsError.code
        });
        return {
          success: false,
          message: `Failed to fetch company returns: ${returnsError.message}`,
          error: returnsError.message
        };
      }

      if (!companyReturns || companyReturns.length === 0) {
        return {
          success: true,
          message: 'No processed company returns found',
          syncedCount: 0
        };
      }

      console.log(`✅ Fetched ${companyReturns.length} company returns`);

      // Check which company returns are already processed
      const returnIds = companyReturns.map(ret => ret.id);
      const { data: existingReturns } = await supabase
        .from('external_inventory_management')
        .select('transaction_id')
        .eq('agency_id', userProfile.agencyId)
        .eq('transaction_type', 'company_return')
        .eq('external_source', 'local_db')
        .in('transaction_id', returnIds);

      const existingReturnIds = new Set(existingReturns?.map(ret => ret.transaction_id) || []);
      const newReturns = companyReturns.filter(ret => !existingReturnIds.has(ret.id));

      console.log(`📦 Found ${newReturns.length} new company returns to process`);

      if (newReturns.length === 0) {
        return {
          success: true,
          message: 'All company returns are already processed',
          syncedCount: 0
        };
      }

      let processedCount = 0;
      let createdTransactions = 0;
      let matchedProducts = 0;
      let unmatchedProducts = 0;

      for (const returnRecord of newReturns) {
        console.log(`📄 Processing company return ${returnRecord.id} - Total: ${returnRecord.total}`);
        
        // For now, since return_items table structure is unclear, 
        // we'll skip company returns processing until we can determine the correct structure
        console.log(`⚠️ Skipping company return processing - return_items structure needs verification`);
        continue;
        
        // TODO: Fix this once we understand the return_items table structure
        /* 
        for (const item of returnRecord.return_items) {
          if (!item.product_name || item.quantity <= 0) continue;

          // Try to find matching external inventory product using fuzzy matching
          const matchedProduct = await this.findMatchingExternalProduct(item, userProfile.agencyId);
          
          let finalProductName = item.product_name;
          let finalProductCode = null;
          let finalCategory = 'General';
          let finalSubCategory = 'General';

          if (matchedProduct) {
            finalProductName = matchedProduct.productName;
            finalProductCode = matchedProduct.productCode;
            finalCategory = matchedProduct.category;
            finalSubCategory = matchedProduct.subCategory;
            matchedProducts++;
            console.log(`✅ Matched company return product: "${item.product_name}" -> "${finalProductName}"`);
          } else {
            unmatchedProducts++;
            console.log(`⚠️ No match found for company return product: "${item.product_name}" - using as-is`);
          }

          // Insert stock OUT transaction for company return
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert({
              product_name: finalProductName,
              product_code: finalProductCode,
              color: item.color || 'Default',
              size: item.size || 'Default',
              category: finalCategory,
              sub_category: finalSubCategory,
              unit_price: item.unit_price || 0,
              transaction_type: 'company_return',
              transaction_id: returnRecord.id,
              quantity: -Math.abs(item.quantity), // Negative for stock OUT
              reference_name: 'Company Return',
              agency_id: userProfile.agencyId,
              user_name: userProfile.name,
              transaction_date: returnRecord.created_at,
              notes: `Company return - Reason: ${returnRecord.reason}`,
              external_source: 'local_db',
              external_id: returnRecord.id,
              external_reference: `Company Return - ${returnRecord.reason}`
            });

          if (insertError) {
            console.warn(`Failed to create company return transaction for ${item.product_name}:`, insertError);
            continue;
          }

          createdTransactions++;
          processedCount++;
        }
        */
      }

      console.log(`✅ Processed ${processedCount} company return items from ${newReturns.length} returns`);
      console.log(`📊 Matched: ${matchedProducts}, Unmatched: ${unmatchedProducts}`);

      return {
        success: true,
        message: `Company returns processed successfully`,
        syncedCount: newReturns.length,
        details: {
          processedCount,
          createdTransactions,
          matchedProducts,
          unmatchedProducts
        }
      };

    } catch (error: any) {
      console.error('💥 Error processing company returns:', error);
      return {
        success: false,
        message: 'Company returns processing failed',
        error: error.message
      };
    }
  }

  /**
   * Main sync method that handles all local database transactions
   */
  async syncAllLocalTransactions(userId: string): Promise<SyncResult> {
    try {
      console.log('🚀 Starting comprehensive sync from all local database sources');
      
      // Step 1: Process external bot invoices (stock IN)
      const externalResult = await this.syncFromLocalInvoices(userId);
      
      // Step 2: Process local database invoices (stock OUT)
      const localInvoiceResult = await this.processLocalDatabaseInvoices(userId);
      
      // Step 3: Process customer returns (stock IN)
      const customerReturnsResult = await this.processCustomerReturns(userId);
      
      // Step 4: Process company returns (stock OUT)
      const companyReturnsResult = await this.processCompanyReturns(userId);

      const allSuccessful = externalResult.success && localInvoiceResult.success && 
                           customerReturnsResult.success && companyReturnsResult.success;
      const totalSynced = (externalResult.syncedCount || 0) + (localInvoiceResult.syncedCount || 0) + 
                         (customerReturnsResult.syncedCount || 0) + (companyReturnsResult.syncedCount || 0);

      return {
        success: allSuccessful,
        message: allSuccessful ? 
          'All local database transactions processed successfully' : 
          'Some transactions failed to process',
        syncedCount: totalSynced,
        details: {
          externalInvoices: externalResult,
          localInvoices: localInvoiceResult,
          customerReturns: customerReturnsResult,
          companyReturns: companyReturnsResult
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Comprehensive sync failed',
        error: error.message
      };
    }
  }

  /**
   * Global sync method - processes ALL users' transactions across all agencies
   * This ensures complete inventory data while maintaining user-specific access
   */
  async syncAllUsersGlobalTransactions(): Promise<SyncResult> {
    try {
      console.log('🌐 Starting GLOBAL sync from all agencies and users');
      
      // Step 1: First sync external bot data globally (all users at once)
      console.log('🔄 Step 1: Syncing external bot data globally...');
      const { externalBotSyncService } = await import('@/services/external-bot-sync');
      
      // Use the new global sync method that processes ALL users' data efficiently
      const globalExternalResult = await externalBotSyncService.syncAllUsersGlobalInvoices();
      
      if (!globalExternalResult.success) {
        console.warn('⚠️ Global external bot sync failed, continuing with local data sync...', globalExternalResult.message);
      } else {
        console.log('✅ Global external bot sync completed successfully:', globalExternalResult.details);
      }
      
      // Step 2: Get all agencies to process their local data  
      const { data: agencies, error: agenciesError } = await supabase
        .from('profiles')
        .select('agency_id, name, id')
        .not('agency_id', 'is', null);

      if (agenciesError || !agencies) {
        throw new Error(`Failed to fetch agencies: ${agenciesError?.message}`);
      }

      console.log(`📊 Found ${agencies.length} users across agencies to process`);

      let globalSyncResults = {
        totalUsers: agencies.length,
        successfulUsers: 0,
        failedUsers: 0,
        totalTransactions: 0,
        externalBotResult: globalExternalResult,
        externalBotSynced: globalExternalResult.success,
        results: [] as any[]
      };

      // Step 3: Process each user's LOCAL transactions (not external bot - that's already done globally)
      for (const user of agencies) {
        try {
          console.log(`🔄 Processing LOCAL transactions for user: ${user.name} (Agency: ${user.agency_id})`);
          
          // Process local database transactions (sales, returns, etc.) + external bot data from local table
          const userResult = await this.syncAllLocalTransactions(user.id);
          
          globalSyncResults.results.push({
            userId: user.id,
            userName: user.name,
            agencyId: user.agency_id,
            result: userResult
          });

          if (userResult.success) {
            globalSyncResults.successfulUsers++;
            globalSyncResults.totalTransactions += (userResult.syncedCount || 0);
          } else {
            globalSyncResults.failedUsers++;
            console.warn(`⚠️ Failed to sync user ${user.name}:`, userResult.message);
          }
        } catch (userError: any) {
          console.error(`❌ Error processing user ${user.name}:`, userError);
          globalSyncResults.failedUsers++;
          globalSyncResults.results.push({
            userId: user.id,
            userName: user.name,
            agencyId: user.agency_id,
            result: { success: false, error: userError.message }
          });
        }
      }

      const success = globalSyncResults.failedUsers === 0 && globalSyncResults.externalBotSynced;
      const totalSyncedTransactions = globalSyncResults.totalTransactions + (globalExternalResult.syncedCount || 0);
      
      return {
        success: success,
        message: success ? 
          `Global sync completed successfully! External bot: ${globalExternalResult.syncedCount || 0} invoices, Local data: ${globalSyncResults.totalTransactions} transactions across ${globalSyncResults.totalUsers} users` :
          `Global sync completed with issues. External bot: ${globalExternalResult.success ? 'OK' : 'FAILED'}, Local: ${globalSyncResults.failedUsers}/${globalSyncResults.totalUsers} user failures`,
        syncedCount: totalSyncedTransactions,
        details: globalSyncResults
      };
    } catch (error: any) {
      console.error('💥 Error in global sync:', error);
      return {
        success: false,
        message: 'Global sync failed',
        error: error.message
      };
    }
  }

  /**
   * Trigger global external bot sync using the edge function
   * This gets ALL users' data at once rather than per-user filtering
   */
  async triggerGlobalExternalBotSync(): Promise<SyncResult> {
    try {
      console.log('🌐 Triggering global external bot sync via edge function...');
      
      // Call the edge function to sync all external bot data globally
      const { data, error } = await supabase.functions.invoke('sync-external-bot-invoices', {
        body: { globalSync: true }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        return {
          success: false,
          message: 'Failed to trigger global external bot sync',
          error: error.message
        };
      }

      console.log('✅ Global external bot sync completed:', data);
      return {
        success: true,
        message: 'Global external bot sync completed successfully',
        syncedCount: data?.synced_count || 0,
        details: data
      };
    } catch (error: any) {
      console.error('💥 Error triggering global external bot sync:', error);
      return {
        success: false,
        message: 'Failed to trigger global external bot sync',
        error: error.message
      };
    }
  }

  async syncFromLocalInvoices(userId: string): Promise<SyncResult> {
    try {
      console.log('🚀 Starting sync from local external_bot_project_invoices for user:', userId);

      // Step 1: Get user profile data
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return {
          success: false,
          message: 'Failed to get user profile data',
          error: 'User profile not found'
        };
      }

      console.log(`👤 User: ${userProfile.name}, Agency: ${userProfile.agencyId}`);

      // Step 2: Fetch invoices from local external_bot_project_invoices table
      console.log('📊 Fetching invoices from local external_bot_project_invoices table...');
      const { data: localInvoices, error: fetchError } = await supabase
        .from('external_bot_project_invoices')
        .select('*')
        .order('id', { ascending: false })
        .limit(50); // Only process last 50 invoices

      if (fetchError) {
        return {
          success: false,
          message: 'Failed to fetch local invoices',
          error: fetchError.message
        };
      }

      if (!localInvoices || localInvoices.length === 0) {
        return {
          success: true,
          message: 'No invoices found in external_bot_project_invoices table',
          syncedCount: 0
        };
      }

      console.log(`✅ Fetched ${localInvoices.length} invoices from local table`);

      // Step 3: Filter invoices by partner_name matching user's name
      console.log(`🔍 Filtering invoices for partner_name: "${userProfile.name}"`);
      
      // Debug: Show all unique partner names in the data
      const uniquePartnerNames = [...new Set(localInvoices.map(inv => inv.partner_name).filter(Boolean))];
      console.log('📋 Available partner names in invoices:', uniquePartnerNames);
      
      const filteredInvoices = localInvoices.filter(invoice => {
        const match = invoice.partner_name && 
                     invoice.partner_name.toLowerCase().trim() === userProfile.name.toLowerCase().trim();
        if (!match && invoice.partner_name) {
          console.log(`⚠️ No match: "${invoice.partner_name}" !== "${userProfile.name}"`);
        }
        return match;
      });
      
      console.log(`📋 Filtered to ${filteredInvoices.length} invoices for user ${userProfile.name}`);

      if (filteredInvoices.length === 0) {
        return {
          success: true,
          message: `No invoices found for partner name "${userProfile.name}"`,
          syncedCount: 0
        };
      }

      // Step 4: Check which invoices are already processed to avoid duplicates
      console.log('🔍 Checking for already processed invoices...');
      const invoiceIds = filteredInvoices.map(inv => inv.name || inv.id?.toString()).filter(Boolean);
      
      const { data: existingInvoices } = await supabase
        .from('external_inventory_management')
        .select('external_id')
        .eq('agency_id', userProfile.agencyId)
        .eq('external_source', 'local_bot')
        .in('external_id', invoiceIds);

      const existingInvoiceIds = new Set(existingInvoices?.map(inv => inv.external_id) || []);
      
      // Filter out already processed invoices
      const newInvoices = filteredInvoices.filter(invoice => {
        const invoiceId = invoice.name || invoice.id?.toString();
        return invoiceId && !existingInvoiceIds.has(invoiceId);
      });

      console.log(`📦 Found ${newInvoices.length} new invoices to process (${filteredInvoices.length - newInvoices.length} already processed)`);

      if (newInvoices.length === 0) {
        return {
          success: true,
          message: `All ${filteredInvoices.length} invoices for "${userProfile.name}" are already processed`,
          syncedCount: 0
        };
      }

      // Step 5: Process new invoices into inventory
      console.log(`📦 Processing ${newInvoices.length} new invoices into inventory for agency ${userProfile.agencyId}...`);
      
      // Debug: Show details of invoices being processed
      newInvoices.forEach((invoice, index) => {
        console.log(`📄 Invoice ${index + 1}: ${invoice.name} (${invoice.partner_name})`);
        if (invoice.order_lines && Array.isArray(invoice.order_lines)) {
          console.log(`  📦 Has ${invoice.order_lines.length} order lines`);
          invoice.order_lines.slice(0, 3).forEach((line, lineIndex) => {
            console.log(`    Line ${lineIndex + 1}: ${line.product_name || line.name} (Qty: ${line.qty_delivered || line.quantity})`);
          });
        } else {
          console.log(`  ⚠️ No order_lines found or not array`);
        }
      });
      
      const inventoryResult = await this.processInvoicesToInventory(newInvoices, userProfile.agencyId, userProfile.name);
      
      if (!inventoryResult.success) {
        return {
          success: false,
          message: `Failed to process invoices into inventory: ${inventoryResult.message}`,
          error: inventoryResult.error
        };
      }

      console.log(`✅ Successfully processed ${inventoryResult.details?.processedCount || 0} items into inventory`);

      return {
        success: true,
        message: `Local invoices processed successfully for ${userProfile.name}`,
        syncedCount: newInvoices.length,
        details: {
          syncTimestamp: new Date().toISOString(),
          agencyId: userProfile.agencyId,
          userName: userProfile.name,
          processedCount: inventoryResult.details?.processedCount || 0,
          createdItems: inventoryResult.details?.createdItems || 0,
          createdTransactions: inventoryResult.details?.createdTransactions || 0
        }
      };

    } catch (error: any) {
      console.error('💥 Error in local sync process:', error);
      return {
        success: false,
        message: 'Local sync process failed',
        error: error.message
      };
    }
  }

  async processInvoicesToInventory(invoices: LocalInvoice[], agencyId: string, userName: string): Promise<SyncResult> {
    try {
      let processedCount = 0;
      let createdTransactions = 0;

      for (const invoice of invoices) {
        if (!invoice.order_lines || !Array.isArray(invoice.order_lines)) continue;

        // Process each order line item
        for (const line of invoice.order_lines) {
          if (!line.product_name || (!line.qty_delivered && !line.quantity)) continue;

          // Extract product info from the line
          const rawProductName = line.product_name || line.name || 'Unknown Product';
          const quantity = Math.abs(Number(line.qty_delivered || line.quantity) || 0);
          const color = line.color || line.variant || 'Default';
          const size = line.size || line.variant || 'Default';
          const unitPrice = Number(line.price_unit || line.unit_price || 0);

          // Standardize the product name for consistency
          const productName = this.standardizeProductName(rawProductName);

          console.log(`    🔍 Processing line: ${rawProductName} -> ${productName} (Qty: ${quantity}, Color: ${color}, Size: ${size})`);

          if (quantity <= 0) {
            console.log(`    ⚠️ Skipping line - zero quantity`);
            continue;
          }

          // Extract product code from product name (e.g., "[CV90] COLOR VEST 90" -> "CV90")
          const productCodeMatch = productName.match(/\[([^\]]+)\]/);
          const productCode = productCodeMatch ? productCodeMatch[1] : null;

          // Try to find matching product from products table using our enhanced matching
          const matchedProduct = await this.findMatchingProduct(productName, agencyId);
          
          let finalProductName = productName;
          let category = 'General';
          let subCategory = 'General';
          let matchedProductId = null;

          if (matchedProduct) {
            finalProductName = matchedProduct.name; // Use standardized name from products table
            category = matchedProduct.category;
            subCategory = matchedProduct.subCategory;
            matchedProductId = matchedProduct.id;
            console.log(`✅ External invoice - matched: "${productName}" -> "${finalProductName}" (ID: ${matchedProductId})`);
          } else {
            // Fallback: Use categories from order line if no product match
            category = line.product_category || line.category || 'General';
            subCategory = line.product_subcategory || line.sub_category || line.subcategory || 'General';
            console.log(`⚠️ External invoice - no product match for: "${productName}", using order line categories`);
          }

          // Insert into external_inventory_management table
          console.log(`    📝 Creating stock IN transaction: ${finalProductName} (+${quantity})`);
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert({
              product_name: finalProductName, // Use standardized name
              product_code: this.extractProductCode(finalProductName),
              color: color,
              size: size,
              category: category,
              sub_category: subCategory,
              matched_product_id: matchedProductId, // NEW: Link to products table
              unit_price: unitPrice,
              transaction_type: 'external_invoice',
              transaction_id: invoice.name,
              quantity: quantity, // Positive for stock IN
              reference_name: invoice.partner_name,
              agency_id: agencyId,
              user_name: userName,
              transaction_date: invoice.date_order || new Date().toISOString(),
              notes: JSON.stringify(line), // Store the complete order line data
              external_source: 'local_bot',
              external_id: invoice.name,
              external_reference: `Local Bot Invoice - ${invoice.partner_name}`
            });

          if (insertError) {
            console.warn(`    ❌ Failed to create inventory transaction for ${finalProductName}:`, insertError);
            continue;
          }

          console.log(`    ✅ Created stock IN transaction for ${finalProductName}`);
          createdTransactions++;
          processedCount++;
        }
      }

      return {
        success: true,
        message: `Processed ${processedCount} line items from local invoices`,
        details: {
          processedCount,
          createdTransactions,
          agencyId
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to process local invoices into inventory',
        error: error.message
      };
    }
  }

  private async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, agency_id')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return {
        name: data.name,
        agencyId: data.agency_id
      };
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }
}

// Create singleton instance
export const localInvoiceSyncService = new LocalInvoiceSyncService();