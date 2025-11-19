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

export interface SyncStatus {
  lastExternalBotSync: {
    timestamp: string | null;
    status: 'success' | 'error' | 'never';
    message: string;
    syncedCount: number;
  };
  lastOdooSync: {
    timestamp: string | null;
    status: 'success' | 'error' | 'never';
    message: string;
    syncedCount: number;
  };
  lastGlobalBotSync: {
    timestamp: string | null;
    status: 'success' | 'error' | 'never' | 'pending';
    message: string;
    processedCount: number;
  };
  nextScheduledSync: {
    externalBot: {
      morning: string; // 6 AM UTC
      evening: string; // 6 PM UTC
    };
    odooLast25: {
      morning: string; // 7:30 AM GMT+5:30 (02:00 UTC)
      evening: string; // 9:30 PM GMT+5:30 (16:00 UTC)
    };
    globalBot: {
      morning: string; // 8 AM UTC  
      evening: string; // 8 PM UTC
    };
  };
  pendingGlobalSyncRequests: number;
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
      .replace(/\s*-\s*/g, '-')          // All dash variations -> "-" (no spaces around dash)
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
      
      const { data, error, count } = await this.externalSupabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('External connection error:', error);
        return {
          success: false,
          message: 'Cannot connect to external database',
          error: error.message
        };
      }

      console.log('External connection successful, invoice count:', count);
      return {
        success: true,
        message: `Successfully connected to external database with ${count} invoices`,
        details: { invoiceCount: count }
      };

    } catch (error: any) {
      console.error('External connection test failed:', error);
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  async testManualSync(): Promise<SyncResult> {
    try {
      console.log('🧪 Testing manual sync process...');
      
      // First test external connection
      const connectionTest = await this.testExternalConnection();
      if (!connectionTest.success) {
        return {
          success: false,
          message: 'External connection test failed',
          error: connectionTest.error
        };
      }

      // Test edge function connectivity
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseServiceKey) {
        return {
          success: false,
          message: 'Service role key not configured',
          error: 'Missing VITE_SUPABASE_SERVICE_ROLE_KEY'
        };
      }

      console.log('🧪 Testing edge function connectivity...');
      
      // Try to call the function with a simple ping
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/sync-external-bot-invoices`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        });

        const responseText = await response.text();
        console.log('🧪 Edge function response:', response.status, responseText);

        return {
          success: true,
          message: 'Test completed',
          details: {
            externalConnection: connectionTest,
            edgeFunctionStatus: response.status,
            edgeFunctionResponse: responseText
          }
        };

      } catch (fetchError: any) {
        console.error('🧪 Edge function test failed:', fetchError);
        return {
          success: false,
          message: 'Edge function connectivity test failed',
          error: fetchError.message
        };
      }

    } catch (error: any) {
      console.error('🧪 Test process failed:', error);
      return {
        success: false,
        message: 'Test process failed',
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

          // No product matching needed - direct relationship via product_name/description
          let category = 'General';
          let subCategory = 'General';
          
          console.log(`📦 Processing product: "${productName}" (no matching required)`);
          globalMatchedProducts++; // All products are considered "matched" since we have direct relationship

          // Insert into external_inventory_management
          const insertData = {
            product_name: productName,
            product_code: this.extractProductCode(productName),
            color: color,
            size: size,
            category: category,
            sub_category: subCategory,
            matched_product_id: null, // No longer needed - direct relationship via product_name/description
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
            agency_id: insertData.agency_id
          });
          
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert(insertData);

          if (insertError) {
            console.warn(`    ❌ Failed to create transaction for ${productName}:`, insertError);
            continue;
          }

          console.log(`    ✅ Created transaction: ${productName}`);
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


  async manualExternalBotSync(): Promise<SyncResult> {
    try {
      console.log('🔄 Starting manual external bot sync...');

      // Get current Supabase URL and service key from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      console.log('🔧 Using Supabase URL:', supabaseUrl);
      console.log('🔧 Service key configured:', !!supabaseServiceKey);

      if (!supabaseServiceKey) {
        return {
          success: false,
          message: 'Service role key not configured for manual sync',
          error: 'Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable'
        };
      }

      // Call the sync edge function directly
      console.log('📡 Calling edge function...');
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-external-bot-invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Manual sync HTTP error ${response.status}:`, errorText);
        return {
          success: false,
          message: `Manual sync failed - HTTP ${response.status}: ${response.statusText}`,
          error: errorText
        };
      }

      const result = await response.json();

      if (result.success) {
        // Log the successful manual sync
        const { error: logError } = await supabase
          .from('external_bot_sync_log')
          .insert({
            sync_timestamp: new Date().toISOString(),
            status: 'success',
            synced_count: result.synced_count || 0,
            message: 'Manual external bot sync completed successfully',
            details: {
              ...result,
              manual_sync: true,
              sync_trigger: 'user_manual'
            }
          });

        if (logError) {
          console.warn('Failed to log manual sync:', logError);
        }

        return {
          success: true,
          message: `Manual external bot sync completed successfully`,
          syncedCount: result.synced_count || 0,
          details: {
            ...result,
            manual_sync: true
          }
        };
      } else {
        // Log the failed manual sync
        const { error: logError } = await supabase
          .from('external_bot_sync_log')
          .insert({
            sync_timestamp: new Date().toISOString(),
            status: 'error',
            synced_count: 0,
            message: 'Manual external bot sync failed',
            details: {
              error: result.error || 'Unknown error',
              manual_sync: true,
              sync_trigger: 'user_manual'
            }
          });

        if (logError) {
          console.warn('Failed to log manual sync error:', logError);
        }

        return {
          success: false,
          message: `Manual external bot sync failed`,
          error: result.error || 'Unknown error'
        };
      }

    } catch (error: any) {
      console.error('Manual external bot sync error:', error);

      // Log the error
      const { error: logError } = await supabase
        .from('external_bot_sync_log')
        .insert({
          sync_timestamp: new Date().toISOString(),
          status: 'error',
          synced_count: 0,
          message: 'Manual external bot sync failed with error',
          details: {
            error: error.message,
            manual_sync: true,
            sync_trigger: 'user_manual'
          }
        });

      if (logError) {
        console.warn('Failed to log manual sync error:', logError);
      }

      return {
        success: false,
        message: 'Manual external bot sync failed',
        error: error.message
      };
    }
  }

  async newsyncOdoo(): Promise<SyncResult> {
    try {
      console.log('🆕 Starting manual Odoo inventory sync (newsyncodoo)...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
      const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseServiceKey) {
        return {
          success: false,
          message: 'Service role key not configured for newsyncodoo',
          error: 'Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable'
        };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/newsyncodoo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          manualTrigger: true,
          sync_trigger: 'manual_ui',
          metadata: {
            source: 'external_inventory_manual_sync',
            timestamp: new Date().toISOString()
          }
        })
      });

      console.log('🆕 newsyncodoo response status:', response.status, response.statusText);

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        const message = payload?.error || payload?.message || `newsyncodoo failed - HTTP ${response.status}`;

        return {
          success: false,
          message,
          error: message
        };
      }

      return {
        success: true,
        message: payload.message || 'newsyncodoo completed successfully',
        syncedCount: payload.insertedTransactions || payload.synced_count || 0,
        details: payload
      };
    } catch (error: any) {
      console.error('newsyncodoo manual sync error:', error);

      return {
        success: false,
        message: 'newsyncodoo manual sync failed',
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

  async getDetailedSyncStatus(): Promise<SyncStatus> {
    try {
      // Get last external bot sync (from Odoo to external_bot_project_invoices)
      const { data: lastExternalSync } = await supabase
        .from('external_bot_sync_log')
        .select('*')
        .order('sync_timestamp', { ascending: false })
        .limit(1)
        .single();

      // Get last global bot sync from new tracking table
      const { data: lastGlobalSync } = await supabase
        .from('global_bot_sync_log')
        .select('*')
        .order('sync_timestamp', { ascending: false })
        .limit(1)
        .single();

      const { data: lastOdooSyncRows } = await supabase
        .from('external_bot_sync_log')
        .select('*')
        .filter('details->>sync_type', 'eq', 'newsyncodoo')
        .in('status', ['success', 'error', 'cron_error'])
        .order('sync_timestamp', { ascending: false })
        .limit(1);

      const lastOdooSync = Array.isArray(lastOdooSyncRows) ? lastOdooSyncRows[0] : null;

      // Get pending global sync requests count
      const { count: pendingGlobalRequests } = await supabase
        .from('global_bot_sync_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cron_requested');

      // Calculate next scheduled sync times
      const now = new Date();
      
      // External bot sync times (6 AM and 6 PM UTC)
      const nextExternalMorning = new Date(now);
      const nextExternalEvening = new Date(now);
      nextExternalMorning.setUTCHours(6, 0, 0, 0);
      nextExternalEvening.setUTCHours(18, 0, 0, 0);
      
      if (now.getUTCHours() >= 6) {
        nextExternalMorning.setUTCDate(nextExternalMorning.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 18) {
        nextExternalEvening.setUTCDate(nextExternalEvening.getUTCDate() + 1);
      }

      // Global bot sync times (8 AM and 8 PM UTC)
      const nextGlobalMorning = new Date(now);
      const nextGlobalEvening = new Date(now);
      nextGlobalMorning.setUTCHours(8, 0, 0, 0);
      nextGlobalEvening.setUTCHours(20, 0, 0, 0);
      
      if (now.getUTCHours() >= 8) {
        nextGlobalMorning.setUTCDate(nextGlobalMorning.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 20) {
        nextGlobalEvening.setUTCDate(nextGlobalEvening.getUTCDate() + 1);
      }

      // Odoo last-25 sync times (07:30 & 21:30 GMT+5:30 => 02:00 & 16:00 UTC)
      const nextOdooMorning = new Date(now);
      const nextOdooEvening = new Date(now);
      nextOdooMorning.setUTCHours(2, 0, 0, 0);
      nextOdooEvening.setUTCHours(16, 0, 0, 0);

      if (now.getUTCHours() > 2 || (now.getUTCHours() === 2 && now.getUTCMinutes() >= 0)) {
        nextOdooMorning.setUTCDate(nextOdooMorning.getUTCDate() + 1);
      }

      if (now.getUTCHours() > 16 || (now.getUTCHours() === 16 && now.getUTCMinutes() >= 0)) {
        nextOdooEvening.setUTCDate(nextOdooEvening.getUTCDate() + 1);
      }

      // Determine global bot sync status
      let globalSyncStatus: 'success' | 'error' | 'never' | 'pending' = 'never';
      let globalSyncMessage = 'No global bot sync found';
      
      if (pendingGlobalRequests && pendingGlobalRequests > 0) {
        globalSyncStatus = 'pending';
        globalSyncMessage = `${pendingGlobalRequests} pending sync request${pendingGlobalRequests > 1 ? 's' : ''}`;
      } else if (lastGlobalSync) {
        globalSyncStatus = lastGlobalSync.status === 'success' || lastGlobalSync.status === 'processed_placeholder' ? 'success' : 'error';
        globalSyncMessage = lastGlobalSync.message || 'Global bot sync completed';
      }

      const syncStatus: SyncStatus = {
        lastExternalBotSync: {
          timestamp: lastExternalSync?.sync_timestamp || null,
          status: lastExternalSync ? (lastExternalSync.status === 'success' ? 'success' : 'error') : 'never',
          message: lastExternalSync?.message || 'No external bot sync found',
          syncedCount: lastExternalSync?.synced_count || 0
        },
        lastOdooSync: {
          timestamp: lastOdooSync?.sync_timestamp || null,
          status: lastOdooSync ? (lastOdooSync.status === 'success' ? 'success' : 'error') : 'never',
          message: lastOdooSync?.message || 'No Odoo sync found',
          syncedCount: lastOdooSync?.synced_count || 0
        },
        lastGlobalBotSync: {
          timestamp: lastGlobalSync?.sync_timestamp || null,
          status: globalSyncStatus,
          message: globalSyncMessage,
          processedCount: lastGlobalSync?.processed_invoices || 0
        },
        nextScheduledSync: {
          externalBot: {
            morning: nextExternalMorning.toISOString(),
            evening: nextExternalEvening.toISOString()
          },
          odooLast25: {
            morning: nextOdooMorning.toISOString(),
            evening: nextOdooEvening.toISOString()
          },
          globalBot: {
            morning: nextGlobalMorning.toISOString(),
            evening: nextGlobalEvening.toISOString()
          }
        },
        pendingGlobalSyncRequests: pendingGlobalRequests || 0
      };

      return syncStatus;

    } catch (error: any) {
      console.error('Error getting detailed sync status:', error);
      
      // Return default status on error
      const now = new Date();
      const nextExternalMorning = new Date(now);
      const nextExternalEvening = new Date(now);
      const nextGlobalMorning = new Date(now);
      const nextGlobalEvening = new Date(now);
      const nextOdooMorning = new Date(now);
      const nextOdooEvening = new Date(now);
      
      nextExternalMorning.setUTCHours(6, 0, 0, 0);
      nextExternalEvening.setUTCHours(18, 0, 0, 0);
      nextGlobalMorning.setUTCHours(8, 0, 0, 0);
      nextGlobalEvening.setUTCHours(20, 0, 0, 0);
      nextOdooMorning.setUTCHours(2, 0, 0, 0);
      nextOdooEvening.setUTCHours(16, 0, 0, 0);
      
      if (now.getUTCHours() >= 6) {
        nextExternalMorning.setUTCDate(nextExternalMorning.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 18) {
        nextExternalEvening.setUTCDate(nextExternalEvening.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 8) {
        nextGlobalMorning.setUTCDate(nextGlobalMorning.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 20) {
        nextGlobalEvening.setUTCDate(nextGlobalEvening.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 2) {
        nextOdooMorning.setUTCDate(nextOdooMorning.getUTCDate() + 1);
      }
      if (now.getUTCHours() >= 16) {
        nextOdooEvening.setUTCDate(nextOdooEvening.getUTCDate() + 1);
      }

      return {
        lastExternalBotSync: {
          timestamp: null,
          status: 'error',
          message: 'Error checking sync status',
          syncedCount: 0
        },
        lastOdooSync: {
          timestamp: null,
          status: 'error',
          message: 'Error checking sync status',
          syncedCount: 0
        },
        lastGlobalBotSync: {
          timestamp: null,
          status: 'error',
          message: 'Error checking sync status',
          processedCount: 0
        },
        nextScheduledSync: {
          externalBot: {
            morning: nextExternalMorning.toISOString(),
            evening: nextExternalEvening.toISOString()
          },
          odooLast25: {
            morning: nextOdooMorning.toISOString(),
            evening: nextOdooEvening.toISOString()
          },
          globalBot: {
            morning: nextGlobalMorning.toISOString(),
            evening: nextGlobalEvening.toISOString()
          }
        },
        pendingGlobalSyncRequests: 0
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

}

// Create singleton instance
export const externalBotSyncService = new ExternalBotSyncService();
