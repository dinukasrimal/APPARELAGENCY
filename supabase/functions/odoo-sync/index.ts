import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  agencyId: string;
  syncType: 'products' | 'invoices' | 'partners';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface SyncResponse {
  success: boolean;
  message: string;
  synced_count: number;
  error_count: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { agencyId, syncType, startDate, endDate, limit = 100 }: SyncRequest = await req.json()

    if (!agencyId) {
      throw new Error('agencyId is required')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Odoo configuration from environment
    const odooConfig = {
      url: Deno.env.get('ODOO_URL'),
      database: Deno.env.get('ODOO_DATABASE'),
      username: Deno.env.get('ODOO_USERNAME'),
      password: Deno.env.get('ODOO_PASSWORD'),
    }

    if (!odooConfig.url || !odooConfig.database || !odooConfig.username || !odooConfig.password) {
      throw new Error('Odoo configuration is incomplete. Please check environment variables.')
    }

    // Odoo API client
    class OdooClient {
      private sessionId: string | null = null;
      private uid: number | null = null;

      async authenticate() {
        const response = await fetch(`${odooConfig.url}/web/session/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              db: odooConfig.database,
              login: odooConfig.username,
              password: odooConfig.password,
            },
            id: 1,
          }),
        });

        const result = await response.json();
        if (result.result && result.result.uid) {
          this.uid = result.result.uid;
          this.sessionId = result.result.session_id;
          return true;
        }
        return false;
      }

      async searchRead(model: string, domain: any[] = [], fields: string[] = []) {
        const response = await fetch(`${odooConfig.url}/web/dataset/search_read`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': `session_id=${this.sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: { model, domain, fields },
            id: 1,
          }),
        });

        const result = await response.json();
        return result.result || [];
      }
    }

    // Initialize Odoo client
    const odooClient = new OdooClient();
    const authenticated = await odooClient.authenticate();

    if (!authenticated) {
      throw new Error('Failed to authenticate with Odoo');
    }

    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Handle different sync types
    switch (syncType) {
      case 'products':
        const products = await odooClient.searchRead(
          'product.product',
          [['sale_ok', '=', true]],
          ['id', 'name', 'description', 'list_price', 'categ_id', 'default_code']
        );

        for (const product of products.slice(0, limit)) {
          try {
            // Check if product already exists
            const { data: existingProduct } = await supabaseClient
              .from('products')
              .select('id')
              .eq('name', product.name)
              .single();

            if (existingProduct) {
              // Update existing product
              await supabaseClient
                .from('products')
                .update({
                  description: product.description || null,
                  selling_price: product.list_price,
                  billing_price: product.list_price,
                  category: product.categ_id?.[1] || 'General',
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingProduct.id);
            } else {
              // Create new product
              await supabaseClient
                .from('products')
                .insert({
                  name: product.name,
                  description: product.description || null,
                  selling_price: product.list_price,
                  billing_price: product.list_price,
                  category: product.categ_id?.[1] || 'General',
                  colors: ['Default'],
                  sizes: ['Default'],
                  created_at: new Date().toISOString()
                });
            }

            syncedCount++;
          } catch (error) {
            errorCount++;
            errors.push(`Product ${product.name}: ${error.message}`);
          }
        }
        break;

      case 'invoices':
        let domain = [['invoice_type', 'in', ['out_invoice', 'out_refund']]];
        if (startDate && endDate) {
          domain.push(['invoice_date', '>=', startDate]);
          domain.push(['invoice_date', '<=', endDate]);
        }

        const invoices = await odooClient.searchRead(
          'account.move',
          domain,
          [
            'id', 'name', 'partner_id', 'invoice_date', 'invoice_due_date',
            'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
            'state', 'payment_state', 'invoice_type', 'reference', 'notes'
          ]
        );

        for (const invoice of invoices.slice(0, limit)) {
          try {
            // Check if invoice already exists
            const { data: existing } = await supabaseClient
              .from('odoo_invoices')
              .select('id')
              .eq('odoo_id', invoice.id)
              .single();

            if (existing) {
              continue; // Skip if already exists
            }

            // Insert invoice
            await supabaseClient
              .from('odoo_invoices')
              .insert({
                odoo_id: invoice.id,
                odoo_name: invoice.name,
                partner_id: invoice.partner_id?.[0] || null,
                partner_name: invoice.partner_id?.[1] || 'Unknown',
                invoice_date: invoice.invoice_date,
                due_date: invoice.invoice_due_date || null,
                amount_untaxed: invoice.amount_untaxed,
                amount_tax: invoice.amount_tax,
                amount_total: invoice.amount_total,
                state: invoice.state,
                payment_state: invoice.payment_state || 'not_paid',
                invoice_type: invoice.invoice_type || 'out_invoice',
                reference: invoice.reference || null,
                notes: invoice.notes || null,
                agency_id: agencyId,
                sync_status: 'synced'
              });

            syncedCount++;
          } catch (error) {
            errorCount++;
            errors.push(`Invoice ${invoice.id}: ${error.message}`);
          }
        }
        break;

      case 'partners':
        const partners = await odooClient.searchRead(
          'res.partner',
          [['is_company', '=', true]],
          ['id', 'name', 'email', 'phone', 'street', 'city', 'country_id', 'customer_rank']
        );

        for (const partner of partners.slice(0, limit)) {
          try {
            // Check if customer already exists
            const { data: existingCustomer } = await supabaseClient
              .from('customers')
              .select('id')
              .eq('name', partner.name)
              .single();

            if (existingCustomer) {
              // Update existing customer
              await supabaseClient
                .from('customers')
                .update({
                  email: partner.email || null,
                  phone: partner.phone || null,
                  address: partner.street || null,
                  city: partner.city || null,
                  country: partner.country_id?.[1] || null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingCustomer.id);
            } else {
              // Create new customer
              await supabaseClient
                .from('customers')
                .insert({
                  name: partner.name,
                  email: partner.email || null,
                  phone: partner.phone || null,
                  address: partner.street || null,
                  city: partner.city || null,
                  country: partner.country_id?.[1] || null,
                  agency_id: agencyId,
                  created_at: new Date().toISOString()
                });
            }

            syncedCount++;
          } catch (error) {
            errorCount++;
            errors.push(`Partner ${partner.name}: ${error.message}`);
          }
        }
        break;

      default:
        throw new Error(`Unsupported sync type: ${syncType}`);
    }

    const response: SyncResponse = {
      success: errorCount === 0,
      message: `Successfully synced ${syncedCount} ${syncType}${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
      synced_count: syncedCount,
      error_count: errorCount,
      errors: errors.slice(0, 10) // Limit error details
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    const response: SyncResponse = {
      success: false,
      message: error.message,
      synced_count: 0,
      error_count: 1,
      errors: [error.message]
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 