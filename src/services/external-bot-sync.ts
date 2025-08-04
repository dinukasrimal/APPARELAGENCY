import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface ExternalInvoice {
  id: number | string;
  name?: string;
  partner_name?: string;
  date_order?: string;
  amount_total?: number;
  state?: string;
  order_lines?: any;
  company_id?: number;
  user_id?: number;
  team_id?: number;
  currency_id?: string;
  payment_state?: string;
  date_invoice?: string;
  invoice_origin?: string;
  reference?: string;
  move_type?: string;
  journal_id?: number;
  fiscal_position_id?: number;
  invoice_payment_term_id?: number;
  auto_post?: boolean;
  to_check?: boolean;
}

interface SyncResult {
  success: boolean;
  message: string;
  syncedCount?: number;
  error?: string;
  details?: any;
}

export class ExternalBotSyncService {
  
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
    
    console.log(`🧹 External bot - product name cleaning: "${productName}" -> "${cleaned}"`);
    return cleaned;
  }

  /**
   * Extract product code from product name (e.g., "[SB42] SOLACE-BLACK 42" -> "SB42")
   */
  private extractProductCode(productName: string): string | null {
    if (!productName) return null;
    const match = productName.match(/^\[([^\]]+)\]/);
    return match ? match[1] : null;
  }
  private externalSupabase;

  constructor() {
    // Initialize external Supabase client
    this.externalSupabase = createClient(
      'https://tnduapjjyqhppclgnqsb.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHVhcGpqeXFocHBjbGducXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTQ4ODcsImV4cCI6MjA2NDc5MDg4N30.4r-K4iFN0U3V9wZoWPLotFEvNVznVvxlAFLuFOvizDw'
    );
  }

  async testExternalConnection(): Promise<SyncResult> {
    try {
      console.log('Testing external database connection...');
      
      const { data, error } = await this.externalSupabase
        .from('invoices')
        .select('count', { count: 'exact', head: true });

      if (error) {
        return {
          success: false,
          message: 'Cannot connect to external database',
          error: error.message
        };
      }

      return {
        success: true,
        message: `Successfully connected to external database`,
        details: { invoiceCount: data }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  async syncAllUsersGlobalInvoices(): Promise<SyncResult> {
    // GLOBAL SYNC - processes data from external_bot_project_invoices table
    try {
      console.log('🌐 Starting GLOBAL sync from external_bot_project_invoices table');

      // Step 1: Fetch last 25 invoices from external_bot_project_invoices table
      console.log('📊 Fetching last 25 invoices from external_bot_project_invoices table...');
      const { data: externalInvoices, error: fetchError } = await supabase
        .from('external_bot_project_invoices')
        .select('*')
        .order('id', { ascending: false })
        .limit(25); // Only process last 25 invoices as requested

      if (fetchError) {
        return {
          success: false,
          message: 'Failed to fetch invoices from external_bot_project_invoices',
          error: fetchError.message
        };
      }

      if (!externalInvoices || externalInvoices.length === 0) {
        return {
          success: true,
          message: 'No invoices found in external_bot_project_invoices table',
          syncedCount: 0
        };
      }

      console.log(`✅ Fetched ${externalInvoices.length} invoices from external_bot_project_invoices table`);

      // Step 2: Get all user profiles to match partner names with agencies
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, name, agency_id')
        .not('agency_id', 'is', null);

      if (usersError || !allUsers) {
        return {
          success: false,
          message: 'Failed to fetch user profiles for matching',
          error: usersError?.message
        };
      }

      console.log(`👥 Found ${allUsers.length} users across agencies`);

      // Step 3: Process invoices directly into external_inventory_management with fuzzy matching
      let processedCount = 0;
      let createdTransactions = 0;
      let matchedInvoices = 0;
      let unmatchedInvoices = 0;
      let globalMatchedProducts = 0;
      let globalUnmatchedProducts = 0;

      for (const invoice of externalInvoices) {
        // Find matching user by partner_name
        const matchingUser = allUsers.find(user => 
          user.name && invoice.partner_name && 
          user.name.toLowerCase().trim() === invoice.partner_name.toLowerCase().trim()
        );

        if (!matchingUser) {
          unmatchedInvoices++;
          console.log(`⚠️ No user match found for partner: "${invoice.partner_name}"`);
          continue;
        }

        matchedInvoices++;
        console.log(`✅ Matched invoice ${invoice.name} -> User: ${matchingUser.name} (Agency: ${matchingUser.agency_id})`);

        // Check if this invoice is already processed for this agency
        const { data: existingInvoice } = await supabase
          .from('external_inventory_management')
          .select('external_id')
          .eq('agency_id', matchingUser.agency_id)
          .eq('external_source', 'global_bot')
          .eq('external_id', invoice.name || invoice.id?.toString())
          .limit(1);

        if (existingInvoice && existingInvoice.length > 0) {
          console.log(`  ⚠️ Invoice ${invoice.name} already processed for agency ${matchingUser.agency_id}`);
          continue;
        }

        // Process invoice order lines with fuzzy matching
        if (!invoice.order_lines || !Array.isArray(invoice.order_lines)) {
          console.log(`  ⚠️ No order lines found for invoice ${invoice.name}`);
          continue;
        }

        for (const line of invoice.order_lines) {
          if (!line.product_name || (!line.qty_delivered && !line.quantity)) continue;

          const productName = line.product_name || line.name || 'Unknown Product';
          const quantity = Math.abs(Number(line.qty_delivered || line.quantity) || 0);
          const color = line.color || line.variant || 'Default';
          const size = line.size || line.variant || 'Default';
          const unitPrice = Number(line.price_unit || line.unit_price || 0);
          const externalProductId = line.product_id?.[0] || line.product_id || null;

          if (quantity <= 0) continue;

          console.log(`    🔍 Processing line: ${productName} (Qty: ${quantity})`);

          // FUZZY MATCH with products table to get matched_product_id
          let matchedProductId = null;
          let category = 'General';
          let subCategory = 'General';

          try {
            // Clean product name for matching by removing prefixes
            const cleanProductName = this.cleanProductNameForMatching(productName);
            console.log(`🧹 Cleaned: "${productName}" -> "${cleanProductName}"`);

            // FIRST: Debug - show what products exist (no agency_id column exists)
            console.log(`🔍 DEBUG: Checking all products in products table`);
            const { data: debugProducts, error: debugError } = await supabase
              .from('products')
              .select('id, name')
              .limit(10);
            
            if (!debugError && debugProducts) {
              console.log(`📋 DEBUG: Found ${debugProducts.length} products in catalog:`);
              debugProducts.forEach(p => console.log(`  - ID: ${p.id}, Name: "${p.name}"`));
            } else {
              console.log(`❌ DEBUG: Error or no products found:`, debugError);
            }

            // Get all products and do client-side matching (no agency filter since column doesn't exist)
            const { data: allProducts, error: allError } = await supabase
              .from('products')
              .select('id, name, category, sub_category');

            if (!allError && allProducts && allProducts.length > 0) {
              console.log(`🔍 Fuzzy matching "${cleanProductName}" against ${allProducts.length} products from products table`);
              
              // Try multiple matching strategies
              let foundMatch = null;
              
              // Strategy 1: Exact match (case insensitive)
              foundMatch = allProducts.find(p => 
                p.name && p.name.toLowerCase().trim() === cleanProductName.toLowerCase().trim()
              );
              if (foundMatch) {
                console.log(`✅ EXACT match: "${cleanProductName}" -> "${foundMatch.name}"`);
              }
              
              // Strategy 2: Product name contains the cleaned name
              if (!foundMatch) {
                foundMatch = allProducts.find(p => 
                  p.name && p.name.toLowerCase().includes(cleanProductName.toLowerCase())
                );
                if (foundMatch) {
                  console.log(`✅ CONTAINS match: "${cleanProductName}" -> "${foundMatch.name}"`);
                }
              }
              
              // Strategy 3: Cleaned name contains the product name
              if (!foundMatch) {
                foundMatch = allProducts.find(p => 
                  p.name && cleanProductName.toLowerCase().includes(p.name.toLowerCase())
                );
                if (foundMatch) {
                  console.log(`✅ REVERSE match: "${cleanProductName}" -> "${foundMatch.name}"`);
                }
              }
              
              // Strategy 4: Remove size/color variants and match base name
              if (!foundMatch) {
                const baseCleanName = cleanProductName
                  .replace(/\s+(28|30|32|34|36|38|40|42|44|46|48|50|xs|s|m|l|xl|xxl)/gi, '')
                  .replace(/-(white|black|beigh|red|blue|green|yellow|grey|gray)/gi, '')
                  .trim();
                console.log(`🔍 Trying base name match: "${baseCleanName}"`);
                
                foundMatch = allProducts.find(p => {
                  if (!p.name) return false;
                  const baseProductName = p.name
                    .replace(/\s+(28|30|32|34|36|38|40|42|44|46|48|50|xs|s|m|l|xl|xxl)/gi, '')
                    .replace(/-(white|black|beigh|red|blue|green|yellow|grey|gray)/gi, '')
                    .trim();
                  return baseProductName.toLowerCase() === baseCleanName.toLowerCase();
                });
                
                if (foundMatch) {
                  console.log(`✅ BASE match: "${baseCleanName}" -> "${foundMatch.name}"`);
                }
              }

              if (foundMatch) {
                matchedProductId = foundMatch.id;
                category = foundMatch.category || 'General';
                subCategory = foundMatch.sub_category || 'General';
                globalMatchedProducts++;
                console.log(`🎯 SUCCESS: Found products.id="${matchedProductId}" for "${cleanProductName}" -> "${foundMatch.name}"`);
              } else {
                globalUnmatchedProducts++;
                console.log(`⚠️ NO match found for: "${cleanProductName}"`);
                console.log(`📋 Sample products in database: ${allProducts.map(p => `"${p.name}"`).slice(0, 3).join(', ')}...`);
              }
            } else {
              globalUnmatchedProducts++;
              console.log(`❌ Error fetching products table: ${allError?.message || 'No products'}`);
            }
          } catch (matchError) {
            console.warn(`Error matching product ${productName}:`, matchError);
            globalUnmatchedProducts++;
          }

          // Insert into external_inventory_management
          console.log(`💾 About to insert with matched_product_id: "${matchedProductId}" (${matchedProductId ? 'HAS VALUE' : 'NULL/UNDEFINED'})`);
          
          const insertData = {
            product_name: productName,
            product_code: this.extractProductCode(productName),
            color: color,
            size: size,
            category: category,
            sub_category: subCategory,
            matched_product_id: matchedProductId, // FUZZY MATCHED PRODUCT ID
            unit_price: unitPrice,
            transaction_type: 'external_invoice',
            transaction_id: invoice.name,
            quantity: quantity, // Positive for stock IN
            reference_name: invoice.partner_name,
            agency_id: matchingUser.agency_id,
            user_name: matchingUser.name,
            transaction_date: invoice.date_order || new Date().toISOString(),
            notes: JSON.stringify(line),
            external_source: 'global_bot',
            external_id: invoice.name,
            external_reference: `Global Bot Sync - ${invoice.partner_name}`
          };
          
          console.log(`📋 Insert data:`, { 
            product_name: insertData.product_name, 
            matched_product_id: insertData.matched_product_id,
            agency_id: insertData.agency_id
          });
          
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert(insertData);

          if (insertError) {
            console.warn(`    ❌ Failed to create transaction for ${productName}:`, insertError);
            continue;
          }

          console.log(`    ✅ Created transaction: ${productName} (matched_product_id: ${matchedProductId})`);
          createdTransactions++;
          processedCount++;
        }
      }

      console.log(`\n📊 Global Sync Results:`);
      console.log(`  📄 Total invoices fetched: ${externalInvoices.length}`);
      console.log(`  ✅ Matched invoices: ${matchedInvoices}`);
      console.log(`  ❓ Unmatched invoices: ${unmatchedInvoices}`);
      console.log(`  📦 Processed items: ${processedCount}`);
      console.log(`  💾 Created transactions: ${createdTransactions}`);
      console.log(`  🎯 Matched products: ${globalMatchedProducts}`);
      console.log(`  ⚠️  Unmatched products: ${globalUnmatchedProducts}`);

      return {
        success: true,
        message: `Global bot sync completed - processed ${processedCount} items from external_bot_project_invoices`,
        syncedCount: matchedInvoices,
        details: {
          externalSource: 'external_bot_project_invoices',
          syncTimestamp: new Date().toISOString(),
          totalInvoicesFetched: externalInvoices.length,
          matchedInvoices,
          unmatchedInvoices,
          processedCount,
          createdTransactions,
          matchedProducts: globalMatchedProducts,
          unmatchedProducts: globalUnmatchedProducts,
          globalSync: true
        }
      };

    } catch (error: any) {
      console.error('💥 Error in global sync process:', error);
      return {
        success: false,
        message: 'Global sync process failed',
        error: error.message
      };
    }
  }

  async syncInvoices(userId: string): Promise<SyncResult> {
    // EXTERNAL DATABASE SYNC RE-ENABLED
    try {
      console.log('🚀 Starting external bot invoices sync for user:', userId);

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

      // Step 2: Test external connection
      const connectionTest = await this.testExternalConnection();
      if (!connectionTest.success) {
        return connectionTest;
      }

      // Step 3: Fetch only the last 50 invoices from external database
      console.log('📊 Fetching last 50 invoices from external database...');
      const { data: externalInvoices, error: fetchError } = await this.externalSupabase
        .from('invoices')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);

      if (fetchError) {
        return {
          success: false,
          message: 'Failed to fetch external invoices',
          error: fetchError.message
        };
      }

      if (!externalInvoices || externalInvoices.length === 0) {
        return {
          success: true,
          message: 'No invoices found in external database',
          syncedCount: 0
        };
      }

      console.log(`✅ Fetched ${externalInvoices.length} invoices from external database`);

      // Step 4: Filter invoices by partner_name matching user's name
      console.log(`🔍 Filtering invoices for partner_name: "${userProfile.name}"`);
      const filteredInvoices = externalInvoices.filter(invoice => {
        return invoice.partner_name && 
               invoice.partner_name.toLowerCase().trim() === userProfile.name.toLowerCase().trim();
      });
      
      console.log(`📋 Filtered to ${filteredInvoices.length} invoices for user ${userProfile.name}`);

      if (filteredInvoices.length === 0) {
        return {
          success: true,
          message: `No invoices found for partner name "${userProfile.name}"`,
          syncedCount: 0
        };
      }

      // Step 5: Check which invoices are already processed to avoid duplicates
      console.log('🔍 Checking for already processed invoices...');
      const invoiceIds = filteredInvoices.map(inv => inv.name || inv.id?.toString()).filter(Boolean);
      
      const { data: existingInvoices } = await supabase
        .from('external_inventory_management')
        .select('external_id')
        .eq('agency_id', userProfile.agencyId)
        .eq('external_source', 'bot')
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

      // Step 6: Process only new invoices directly into inventory
      console.log(`📦 Processing ${newInvoices.length} new invoices into inventory for agency ${userProfile.agencyId}...`);
      
      // Transform new invoices for processing
      const transformedInvoices = newInvoices.map((invoice: ExternalInvoice, index: number) => {
        return {
          invoice_number: invoice.name || invoice.id?.toString() || `INV-${Date.now() + index}`,
          customer_name: invoice.partner_name || 'Unknown Customer',
          invoice_date: invoice.date_order || null,
          total_amount: invoice.amount_total || 0,
          status: invoice.state || 'unknown',
          payment_status: invoice.payment_state || 'pending',
          notes: JSON.stringify(invoice.order_lines || []),
          agency_id: userProfile.agencyId,
          currency: invoice.currency_id || 'LKR'
        };
      });

      // Process invoices directly into inventory
      const inventoryResult = await this.processInvoicesToInventory(transformedInvoices, userProfile.agencyId, userProfile.name);
      
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
        message: `External bot invoices processed successfully for ${userProfile.name}`,
        syncedCount: newInvoices.length,
        details: {
          externalSource: 'tnduapjjyqhppclgnqsb.supabase.co',
          syncTimestamp: new Date().toISOString(),
          agencyId: userProfile.agencyId,
          userName: userProfile.name,
          processedCount: inventoryResult.details?.processedCount || 0,
          createdItems: inventoryResult.details?.createdItems || 0,
          createdTransactions: inventoryResult.details?.createdTransactions || 0
        }
      };

    } catch (error: any) {
      console.error('💥 Error in sync process:', error);
      return {
        success: false,
        message: 'Sync process failed',
        error: error.message
      };
    }
  }

  async getSyncStatus(): Promise<SyncResult> {
    try {
      const { count, error } = await supabase
        .from('external_bot_project_invoices')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return {
          success: false,
          message: 'Cannot check sync status',
          error: error.message
        };
      }

      // Get latest sync timestamp
      const { data: latestRecord } = await supabase
        .from('external_bot_project_invoices')
        .select('sync_timestamp')
        .order('sync_timestamp', { ascending: false })
        .limit(1)
        .single();

      return {
        success: true,
        message: `External bot invoices status`,
        details: {
          totalRecords: count,
          lastSyncTimestamp: latestRecord?.sync_timestamp || null
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Status check failed',
        error: error.message
      };
    }
  }

  // Get user profile data including name for matching
  private async getUserProfile(userId: string): Promise<{name: string, agencyId: string} | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, agency_id')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('Failed to get user profile:', error);
        return null;
      }

      return {
        name: profile.name,
        agencyId: profile.agency_id
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  async processInvoicesToInventory(invoices: any[], agencyId: string, userName: string): Promise<SyncResult> {
    try {
      let processedCount = 0;
      let createdTransactions = 0;
      let matchedProducts = 0;
      let unmatchedProducts = 0;

      for (const invoice of invoices) {
        if (!invoice.notes) continue;

        let orderLines: any[] = [];
        
        // Parse order_lines from the notes field (where we stored the JSON)
        try {
          orderLines = JSON.parse(invoice.notes);
          if (!Array.isArray(orderLines)) {
            console.warn(`Order lines is not an array for invoice ${invoice.invoice_number}`);
            continue;
          }
        } catch (e) {
          console.warn(`Failed to parse order_lines for invoice ${invoice.invoice_number}:`, e);
          continue;
        }

        // Process each order line item
        for (const line of orderLines) {
          if (!line.product_name || (!line.qty_delivered && !line.quantity)) continue;

          // Extract product info from the line
          const productName = line.product_name || line.name || 'Unknown Product';
          const quantity = Math.abs(Number(line.qty_delivered || line.quantity) || 0);
          const color = line.color || line.variant || 'Default';
          const size = line.size || line.variant || 'Default';
          const unitPrice = Number(line.price_unit || line.unit_price || 0);
          const externalProductId = line.product_id?.[0] || line.product_id || null; // External system's product ID
          
          console.log(`🔗 External product ID: ${externalProductId} for product: ${productName}`);

          if (quantity <= 0) continue;

          // Extract product code from product name (e.g., "[CV90] COLOR VEST 90" -> "CV90")
          const productCodeMatch = productName.match(/\[([^\]]+)\]/);
          const productCode = productCodeMatch ? productCodeMatch[1] : null;

          // Enhanced product matching - find matching product for linking
          let category = 'General';
          let subCategory = 'General';
          let matchedProductId = null;
          
          try {
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
            const cleanProductName = this.cleanProductNameForMatching(productName);
            console.log(`🔧 External bot - cleaned: "${productName}" -> "${cleanProductName}"`);
            
            let { data: exactMatch, error: exactError } = await supabase
              .from('products')
              .select('id, name, category, sub_category')
              .eq('agency_id', agencyId)
              .ilike('name', escapeForIlike(cleanProductName))
              .limit(1);

            if (!exactError && exactMatch && exactMatch.length > 0) {
              category = exactMatch[0].category || 'General';
              subCategory = exactMatch[0].sub_category || 'General';
              matchedProductId = exactMatch[0].id;
              console.log(`✅ External bot - exact match: "${cleanProductName}" matches "${exactMatch[0].name}" (ID: ${matchedProductId})`);
            } else {
              // Method 2: Try matching by product code if available
              if (productCode) {
                const { data: codeMatch, error: codeError } = await supabase
                  .from('products')
                  .select('id, name, category, sub_category')
                  .eq('agency_id', agencyId)
                  .ilike('name', `%${escapeForIlike(productCode)}%`)
                  .limit(1);

                if (!codeError && codeMatch && codeMatch.length > 0) {
                  category = codeMatch[0].category || 'General';
                  subCategory = codeMatch[0].sub_category || 'General';
                  matchedProductId = codeMatch[0].id;
                  console.log(`✅ External bot - code match: "${productName}" -> "${codeMatch[0].name}" (ID: ${matchedProductId})`);
                } else {
                  // Method 3: Try fuzzy matching by base name
                  const baseName = productName
                    .replace(/^\[[^\]]+\]\s*/, '') // Remove product codes
                    .replace(/-(black|beigh|white|red|blue|green|yellow|grey|gray)/gi, '') // Remove colors
                    .replace(/\s+(xs|s|m|l|xl|xxl|xxxl|\d+)$/gi, '') // Remove sizes
                    .trim();

                  if (baseName && baseName !== productName) {
                    const { data: fuzzyMatch, error: fuzzyError } = await supabase
                      .from('products')
                      .select('id, name, category, sub_category')
                      .eq('agency_id', agencyId)
                      .ilike('name', `%${escapeForIlike(baseName)}%`)
                      .limit(1);

                    if (!fuzzyError && fuzzyMatch && fuzzyMatch.length > 0) {
                      category = fuzzyMatch[0].category || 'General';
                      subCategory = fuzzyMatch[0].sub_category || 'General';
                      matchedProductId = fuzzyMatch[0].id;
                      console.log(`✅ External bot - fuzzy match: "${productName}" -> "${fuzzyMatch[0].name}" (ID: ${matchedProductId})`);
                    } else {
                      console.log(`⚠️ External bot - no product match found for: "${productName}" (agency: ${agencyId})`);
                    }
                  } else {
                    console.log(`⚠️ External bot - no product match found for: "${productName}" (agency: ${agencyId})`);
                  }
                }
              } else {
                console.log(`⚠️ External bot - no product code and no exact match for: "${productName}" (agency: ${agencyId})`);
              }
            }
          } catch (lookupError) {
            console.warn(`Error looking up product ${productName}:`, lookupError);
            // Continue with defaults
          }

          // Insert directly into external_inventory_management table
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert({
              product_name: productName,
              product_code: productCode,
              color: color,
              size: size,
              category: category,
              sub_category: subCategory,
              matched_product_id: matchedProductId, // CRITICAL: Link to products table for proper matching
              external_product_id: externalProductId, // External system's product ID
              unit_price: unitPrice,
              transaction_type: 'external_invoice',
              transaction_id: invoice.invoice_number,
              quantity: quantity, // Positive for stock IN
              reference_name: invoice.customer_name,
              agency_id: agencyId,
              user_name: userName,
              transaction_date: invoice.invoice_date || new Date().toISOString(),
              notes: JSON.stringify(line), // Store the complete order line data
              external_source: 'bot',
              external_id: invoice.invoice_number,
              external_reference: `External Bot Invoice - ${invoice.customer_name}`
            });

          if (insertError) {
            console.warn(`Failed to create inventory transaction for ${productName}:`, insertError);
            continue;
          }

          // Track product matching stats
          if (matchedProductId) {
            matchedProducts++;
          } else {
            unmatchedProducts++;
          }

          createdTransactions++;
          processedCount++;
        }
      }

      return {
        success: true,
        message: `Processed ${processedCount} line items into external inventory`,
        details: {
          processedCount,
          createdTransactions,
          matchedProducts,
          unmatchedProducts,
          agencyId
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to process invoices into external inventory',
        error: error.message
      };
    }
  }
}

// Create singleton instance
export const externalBotSyncService = new ExternalBotSyncService();