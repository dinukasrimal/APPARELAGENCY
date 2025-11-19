import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * ENV REQUIREMENTS (no quotes in values):
 * ODOO_URL=http://143.110.240.98:8069
 * ODOO_DATABASE=dagapparel
 * ODOO_USERNAME=dinuka@dag-apparel.com   // or your actual Odoo user
 * ODOO_PASSWORD=0778257989               // the correct login password
 */

// ---------- Supabase Client ----------

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---------- Odoo Config ----------

const rawOdooUrl =
  Deno.env.get('ODOO_URL') || Deno.env.get('VITE_ODOO_URL') || '';
const odooDb =
  Deno.env.get('ODOO_DATABASE') ||
  Deno.env.get('ODOO_DB') ||
  Deno.env.get('VITE_ODOO_DATABASE') ||
  '';
const odooUsername =
  Deno.env.get('ODOO_USERNAME') ||
  Deno.env.get('VITE_ODOO_USERNAME') ||
  '';
const odooPassword =
  Deno.env.get('ODOO_PASSWORD') ||
  Deno.env.get('VITE_ODOO_PASSWORD') ||
  '';

const normalizeBaseUrl = (url: string) =>
  url.replace(/\/web\/login\/?$/i, '').replace(/\/+$/g, '');

const odooBaseUrl = normalizeBaseUrl(rawOdooUrl);

// ---------- Helpers ----------

const logOdooSyncResult = async (
  status: 'success' | 'error',
  message: string,
  details: any,
  syncedCount = 0,
  trigger = 'manual_ui'
) => {
  try {
    const { error } = await supabase.from('external_bot_sync_log').insert({
      sync_timestamp: new Date().toISOString(),
      status,
      synced_count: status === 'success' ? syncedCount : 0,
      message,
      details: {
        ...details,
        sync_type: 'newsyncodoo',
        sync_trigger: trigger
      }
    });

    if (error) {
      console.error('Failed to log newsyncodoo manual sync result:', error);
    }
  } catch (loggingError) {
    console.error(
      'Unexpected error while logging newsyncodoo manual sync result:',
      loggingError
    );
  }
};

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });

// ---------- Odoo Auth via /jsonrpc ----------

interface OdooAuthContext {
  uid: number;
  baseUrl: string;
}

interface OdooInvoiceLine {
  id: number;
  product_id?: [number, string];
  name?: string;
  quantity?: number;
  price_unit?: number;
  discount?: number;
}

interface OdooProduct {
  id: number;
  categ_id?: [number, string];
}

// Authenticate using official JSON-RPC "common.authenticate"
const authenticateWithOdoo = async (): Promise<OdooAuthContext> => {
  if (!odooBaseUrl || !odooDb || !odooUsername || !odooPassword) {
    throw new Error(
      'Missing Odoo configuration. Please set ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD env vars.'
    );
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'common',
      method: 'authenticate',
      args: [odooDb, odooUsername, odooPassword, {}]
    },
    id: 1
  };

  const res = await fetch(`${odooBaseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(
      `Failed to authenticate with Odoo (HTTP ${res.status})`
    );
  }

  const json = await res.json();
  console.log('Odoo auth payload:', JSON.stringify(json));

  if (json.error) {
    const msg =
      json.error.data?.message ||
      json.error.message ||
      'Unknown Odoo authentication error';
    throw new Error(`Odoo authentication error: ${msg}`);
  }

  const uid = json.result;
  if (!uid || typeof uid !== 'number') {
    throw new Error(
      'Odoo authentication failed: invalid credentials or no uid returned'
    );
  }

  return { uid, baseUrl: odooBaseUrl };
};

// Generic execute_kw via /jsonrpc
const odooCall = async (
  auth: OdooAuthContext,
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {}
): Promise<any> => {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'object',
      method: 'execute_kw',
      args: [odooDb, auth.uid, odooPassword, model, method, args, kwargs]
    },
    id: Date.now()
  };

  const res = await fetch(`${auth.baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Odoo RPC HTTP error (HTTP ${res.status})`);
  }

  const json = await res.json();

  if (json.error) {
    const msg =
      json.error.data?.message ||
      json.error.message ||
      'Unknown Odoo RPC error';
    throw new Error(`Odoo RPC error: ${msg}`);
  }

  return json.result;
};

// ---------- Odoo Data Fetchers ----------

// domain only in args, not in kwargs
const fetchRecentInvoices = async (
  auth: OdooAuthContext,
  limit = 25
) => {
  return odooCall(
    auth,
    'account.move',
    'search_read',
    [
      [
        ['move_type', '=', 'out_invoice']
      ]
    ],
    {
      fields: [
        'id',
        'name',
        'partner_id',
        'invoice_date',
        'create_date',
        'invoice_line_ids'
        // 'partner_name' removed (not in your DB)
      ],
      limit,
      order: 'create_date desc'
    }
  );
};

const fetchInvoiceLines = async (
  auth: OdooAuthContext,
  lineIds: number[]
) => {
  if (!lineIds.length) return [];
  return odooCall(
    auth,
    'account.move.line',
    'read',
    [
      lineIds,
      [
        'id',
        'move_id',
        'product_id',
        'name',
        'quantity',
        'price_unit',
        'discount'
      ]
    ],
    {}
  );
};

const fetchProductCategories = async (
  auth: OdooAuthContext,
  productIds: number[]
) => {
  if (!productIds.length) return new Map<number, string>();

  const categoryMap = new Map<number, string>();
  const chunks = chunkArray(productIds, 200);

  for (const chunk of chunks) {
    const products = await odooCall(
      auth,
      'product.product',
      'read',
      [chunk, ['id', 'categ_id']],
      {}
    ) as OdooProduct[];

    products.forEach((product) => {
      if (!product?.id) return;
      const name = Array.isArray(product.categ_id)
        ? product.categ_id[1]
        : undefined;

      if (name) {
        categoryMap.set(product.id, name);
      }
    });
  }

  return categoryMap;
};

// ---------- Supabase Helpers ----------

const buildProfileMap = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, agency_id')
    .not('agency_id', 'is', null);

  if (error) {
    throw new Error(`Failed to load profiles: ${error.message}`);
  }

  const map = new Map<string, any>();
  data?.forEach((profile) => {
    if (profile.name && profile.agency_id) {
      map.set(profile.name.toLowerCase().trim(), profile);
    }
  });

  return map;
};

const chunkArray = <T,>(items: T[], chunkSize = 200): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const sanitizeQuantity = (qty: any) => {
  if (!qty || Number.isNaN(qty)) return 0;
  return Math.round(Number(qty));
};

// ---------- Main Sync Logic ----------

const syncInvoicesToInventory = async () => {
  const auth = await authenticateWithOdoo();

  const invoices = await fetchRecentInvoices(auth);
  if (!invoices || invoices.length === 0) {
    return {
      success: true,
      message: 'No invoices fetched from Odoo',
      invoicesFetched: 0,
      insertedTransactions: 0
    };
  }

  const profileMap = await buildProfileMap();

  const allLineIds = Array.from(
    new Set(
      invoices
        .flatMap((inv: any) => inv.invoice_line_ids || [])
        .filter((id: any) => typeof id === 'number')
    )
  );

  const invoiceLines = await fetchInvoiceLines(auth, allLineIds);

  const lineLookup = new Map<number, any>();
  invoiceLines.forEach((line: any) => {
    lineLookup.set(line.id, line);
  });

  const productIds = Array.from(
    new Set(
      invoiceLines
        .map((line: OdooInvoiceLine) =>
          Array.isArray(line.product_id) ? line.product_id[0] : undefined
        )
        .filter((id): id is number => typeof id === 'number')
    )
  );
  const productCategoryMap = await fetchProductCategories(auth, productIds);

  const invoiceIds = invoices
    .map((inv: any) => inv.id?.toString())
    .filter(Boolean);

  const existingSet = new Set<string>();
  if (invoiceIds.length > 0) {
    const { data: existing } = await supabase
      .from('external_inventory_management')
      .select('external_id, agency_id')
      .eq('external_source', 'newsyncodoo')
      .in('external_id', invoiceIds);

    existing?.forEach((record: any) => {
      if (record.external_id && record.agency_id) {
        existingSet.add(`${record.external_id}:${record.agency_id}`);
      }
    });
  }

  const rowsToInsert: any[] = [];
  let unmatchedPartners = 0;
  let skippedExisting = 0;

  invoices.forEach((invoice: any) => {
    const partnerName =
      invoice.partner_name || // safe even if not fetched
      invoice.partner_id?.[1] ||
      'Unknown Customer';

    const profile = partnerName
      ? profileMap.get(partnerName.toLowerCase().trim())
      : undefined;

    if (!profile?.agency_id) {
      unmatchedPartners += 1;
      return;
    }

    const uniqueKey = `${invoice.id}:${profile.agency_id}`;
    if (existingSet.has(uniqueKey)) {
      skippedExisting += 1;
      return;
    }

    const transactionDate =
      invoice.invoice_date ||
      invoice.create_date ||
      new Date().toISOString();

    const lines = (invoice.invoice_line_ids || [])
      .map((id: number) => lineLookup.get(id))
      .filter((line: any) => Boolean(line));

    lines.forEach((line: any) => {
      const qty = sanitizeQuantity(line.quantity);
      if (qty === 0) return;

      const productCode = Array.isArray(line.product_id)
        ? line.product_id[0]?.toString() ?? null
        : null;
      const productId = Array.isArray(line.product_id)
        ? Number(line.product_id[0])
        : undefined;
      const subCategory =
        (productId && productCategoryMap.get(productId)) || 'General';

      const productDisplayName =
        line.name ||
        (Array.isArray(line.product_id)
          ? line.product_id[1]
          : null) ||
        'Unknown Product';

      rowsToInsert.push({
        product_name: productDisplayName,
        product_code: productCode,
        color: 'Default',
        size: 'Default',
        category: subCategory,
        sub_category: subCategory,
        unit_price: line.price_unit || 0,
        transaction_type: 'external_invoice',
        transaction_id:
          invoice.name ||
          invoice.id?.toString() ||
          `ODOO-${invoice.id}`,
        quantity: qty,
        reference_name: partnerName,
        agency_id: profile.agency_id,
        user_id: profile.id,
        user_name: profile.name,
        transaction_date: transactionDate,
        notes: JSON.stringify({
          invoice_id: invoice.id,
          invoice_line_id: line.id,
          product_id: line.product_id?.[0] || null,
          discount: line.discount || 0
        }),
        external_source: 'newsyncodoo',
        external_id: invoice.id?.toString(),
        external_reference: `Odoo Sync ${
          invoice.name || invoice.id
        }`,
        approval_status: 'approved'
      });
    });

    existingSet.add(uniqueKey);
  });

  if (rowsToInsert.length === 0) {
    return {
      success: true,
      message: 'No new transactions to insert from Odoo invoices',
      invoicesFetched: invoices.length,
      insertedTransactions: 0,
      unmatchedPartners,
      skippedExisting
    };
  }

  const chunks = chunkArray(rowsToInsert, 300);
  let inserted = 0;

  for (const chunk of chunks) {
    const { error } = await supabase
      .from('external_inventory_management')
      .insert(chunk);

    if (error) {
      throw new Error(
        `Failed to insert Odoo transactions: ${error.message}`
      );
    }
    inserted += chunk.length;
  }

  return {
    success: true,
    message: `Inserted ${inserted} inventory transactions from Odoo`,
    invoicesFetched: invoices.length,
    insertedTransactions: inserted,
    unmatchedPartners,
    skippedExisting
  };
};

// ---------- HTTP Handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestContext: any = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      requestContext = await req.json();
    } catch {
      requestContext = {};
    }
  }

  const manualTrigger = Boolean(requestContext?.manualTrigger);
  const triggerLabel =
    typeof requestContext?.sync_trigger === 'string'
      ? String(requestContext.sync_trigger)
      : manualTrigger
        ? 'manual_ui'
        : 'automatic_cron';

  try {
    const result = await syncInvoicesToInventory();

    await logOdooSyncResult(
      'success',
      manualTrigger
        ? 'newsyncodoo manual sync completed successfully'
        : 'newsyncodoo automatic sync completed successfully',
      {
        ...result,
        trigger_metadata: requestContext?.metadata,
        manual_trigger: manualTrigger
      },
      result.insertedTransactions ?? result.synced_count ?? 0,
      triggerLabel
    );

    return respond(200, {
      ...result,
      sync: 'newsyncodoo',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('newsyncodoo failed:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown error';

    await logOdooSyncResult(
      'error',
      manualTrigger
        ? 'newsyncodoo manual sync failed'
        : 'newsyncodoo automatic sync failed',
      {
        error: message,
        trigger_metadata: requestContext?.metadata,
        manual_trigger: manualTrigger
      },
      0,
      triggerLabel
    );

    return respond(500, {
      success: false,
      error: message,
      sync: 'newsyncodoo',
      timestamp: new Date().toISOString()
    });
  }
});
