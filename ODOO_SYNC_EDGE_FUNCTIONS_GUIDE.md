# Odoo Sync: Edge Functions Guide

This guide explains whether you need Supabase Edge Functions for Odoo synchronization and how to implement them if required.

## Do You Need Edge Functions?

### **For Most Cases: NO** ❌

The current implementation works directly from the frontend because:

1. **Odoo API is accessible** from browser environments
2. **Supabase client** handles authentication and data operations
3. **Environment variables** with `VITE_` prefix are available in frontend
4. **CORS is properly configured** on your Odoo server

### **When You DO Need Edge Functions** ✅

Consider edge functions if you have:

1. **CORS Issues** - Odoo server blocks browser requests
2. **Security Concerns** - Don't want Odoo credentials in frontend
3. **Rate Limiting** - Need to handle large sync operations
4. **Complex Processing** - Heavy data transformation
5. **Scheduled Syncs** - Automated background syncs

## Current Implementation (Frontend-Based)

### How It Works

```typescript
// Direct frontend sync (current approach)
const syncInvoices = async () => {
  // 1. Authenticate with Odoo
  await odooService.initialize();
  
  // 2. Fetch data from Odoo
  const invoices = await odooService.getInvoices();
  
  // 3. Store in Supabase
  await supabase.from('odoo_invoices').insert(invoices);
};
```

### Pros
- ✅ **Simple setup** - No additional infrastructure
- ✅ **Real-time feedback** - Immediate UI updates
- ✅ **Easy debugging** - Browser dev tools
- ✅ **No cold starts** - Instant execution

### Cons
- ❌ **CORS dependency** - Requires Odoo server configuration
- ❌ **Credential exposure** - Environment variables in frontend
- ❌ **Browser limitations** - Timeout on large operations
- ❌ **No background processing** - User must stay on page

## Edge Functions Implementation (Alternative)

If you need edge functions, here's how to implement them:

### 1. Create Edge Function

```bash
# Create edge function
npx supabase functions new odoo-sync
```

### 2. Edge Function Code

```typescript
// supabase/functions/odoo-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { agencyId, startDate, endDate, limit = 100 } = await req.json()

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

    // Build domain for invoice search
    let domain = [['invoice_type', 'in', ['out_invoice', 'out_refund']]];
    if (startDate && endDate) {
      domain.push(['invoice_date', '>=', startDate]);
      domain.push(['invoice_date', '<=', endDate]);
    }

    // Fetch invoices from Odoo
    const invoices = await odooClient.searchRead(
      'account.move',
      domain,
      [
        'id', 'name', 'partner_id', 'invoice_date', 'invoice_due_date',
        'amount_untaxed', 'amount_tax', 'amount_total', 'currency_id',
        'state', 'payment_state', 'invoice_type', 'reference', 'notes'
      ]
    );

    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each invoice
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
        const { error: insertError } = await supabaseClient
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

        if (insertError) {
          throw new Error(`Failed to insert invoice: ${insertError.message}`);
        }

        syncedCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Invoice ${invoice.id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: `Synced ${syncedCount} invoices${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
        synced_count: syncedCount,
        error_count: errorCount,
        errors: errors.slice(0, 10) // Limit error details
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        synced_count: 0,
        error_count: 1,
        errors: [error.message]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
```

### 3. Environment Variables

Add to your Supabase project settings:

```env
# Odoo Configuration
ODOO_URL=https://your-odoo-instance.com
ODOO_DATABASE=your_database_name
ODOO_USERNAME=your_username@example.com
ODOO_PASSWORD=your_password

# Supabase Configuration (auto-added)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Deploy Edge Function

```bash
# Deploy the function
npx supabase functions deploy odoo-sync

# Set environment variables
npx supabase secrets set ODOO_URL=https://your-odoo-instance.com
npx supabase secrets set ODOO_DATABASE=your_database_name
npx supabase secrets set ODOO_USERNAME=your_username@example.com
npx supabase secrets set ODOO_PASSWORD=your_password
```

### 5. Frontend Integration

```typescript
// Updated sync function using edge function
const syncInvoicesWithEdgeFunction = async (agencyId: string) => {
  const { data, error } = await supabase.functions.invoke('odoo-sync', {
    body: {
      agencyId,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      limit: 100
    }
  });

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }

  return data;
};
```

## Comparison: Frontend vs Edge Functions

| Aspect | Frontend Sync | Edge Functions |
|--------|---------------|----------------|
| **Setup Complexity** | Simple | Moderate |
| **CORS Requirements** | Yes | No |
| **Credential Security** | Exposed | Secure |
| **Performance** | Good | Better |
| **Scalability** | Limited | High |
| **Background Processing** | No | Yes |
| **Error Handling** | Browser-based | Server-based |
| **Cost** | Free | Per execution |

## Recommendations

### **Start with Frontend Sync** (Current Implementation)
- ✅ **Easier to implement and debug**
- ✅ **No additional infrastructure costs**
- ✅ **Immediate feedback to users**
- ✅ **Sufficient for most use cases**

### **Move to Edge Functions If**:
- ❌ **CORS issues persist**
- ❌ **Security requirements demand it**
- ❌ **Large data volumes (>1000 records)**
- ❌ **Need scheduled/background syncs**
- ❌ **Complex data processing required**

## Migration Path

If you decide to move to edge functions later:

1. **Keep frontend sync** as fallback
2. **Add edge function** alongside existing code
3. **Test thoroughly** with small datasets
4. **Gradually migrate** based on performance
5. **Monitor costs** and usage patterns

## Testing Edge Functions

```bash
# Test locally
npx supabase functions serve odoo-sync

# Test deployed function
curl -X POST https://your-project.supabase.co/functions/v1/odoo-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agencyId": "your-agency-id", "limit": 10}'
```

## Monitoring and Debugging

### Edge Function Logs
```bash
# View logs
npx supabase functions logs odoo-sync

# Real-time logs
npx supabase functions logs odoo-sync --follow
```

### Performance Monitoring
- Monitor execution time
- Track memory usage
- Check error rates
- Monitor costs

## Conclusion

**For your current needs, the frontend-based sync is sufficient and recommended.** It provides:

- ✅ **Simple implementation**
- ✅ **Good performance** for typical use cases
- ✅ **Easy debugging** and maintenance
- ✅ **No additional costs**

Only consider edge functions if you encounter specific limitations or requirements that the frontend approach cannot handle. 