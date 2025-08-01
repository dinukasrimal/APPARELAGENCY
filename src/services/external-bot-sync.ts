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

  async syncInvoices(userId: string): Promise<SyncResult> {
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

      // Step 3: Fetch external invoices
      console.log('📊 Fetching invoices from external database...');
      const { data: externalInvoices, error: fetchError } = await this.externalSupabase
        .from('invoices')
        .select('*')
        .order('id', { ascending: false });

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

      // Step 5: Process invoices directly into inventory (skip problematic storage table)
      console.log(`📦 Processing ${filteredInvoices.length} invoices directly into inventory for agency ${userProfile.agencyId}...`);
      
      // Transform invoices for processing
      const transformedInvoices = filteredInvoices.map((invoice: ExternalInvoice, index: number) => {
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
        syncedCount: filteredInvoices.length,
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
          const category = line.product_category || 'External Import';

          if (quantity <= 0) continue;

          // Extract product code from product name (e.g., "[CV90] COLOR VEST 90" -> "CV90")
          const productCodeMatch = productName.match(/\[([^\]]+)\]/);
          const productCode = productCodeMatch ? productCodeMatch[1] : null;

          // Insert directly into external_inventory_management table
          const { error: insertError } = await supabase
            .from('external_inventory_management')
            .insert({
              product_name: productName,
              product_code: productCode,
              color: color,
              size: size,
              category: category,
              sub_category: 'Bot Import',
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