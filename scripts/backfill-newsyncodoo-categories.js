import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const odooUrl = process.env.ODOO_URL || process.env.VITE_ODOO_URL;
const odooDb =
  process.env.ODOO_DATABASE ||
  process.env.ODOO_DB ||
  process.env.VITE_ODOO_DATABASE;
const odooUsername =
  process.env.ODOO_USERNAME ||
  process.env.VITE_ODOO_USERNAME;
const odooPassword =
  process.env.ODOO_PASSWORD ||
  process.env.VITE_ODOO_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!odooUrl || !odooDb || !odooUsername || !odooPassword) {
  console.error('Missing Odoo credentials (ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const authenticateWithOdoo = async () => {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'common',
      method: 'authenticate',
      args: [odooDb, odooUsername, odooPassword, {}]
    },
    id: Date.now()
  };

  const res = await fetch(`${odooUrl.replace(/\/+$/g, '')}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Odoo auth failed (HTTP ${res.status})`);
  }

  const json = await res.json();
  if (json.error || typeof json.result !== 'number') {
    throw new Error(json.error?.data?.message || json.error?.message || 'Invalid Odoo auth response');
  }

  return json.result;
};

const callOdoo = async (uid, model, method, args = [], kwargs = {}) => {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'object',
      method: 'execute_kw',
      args: [odooDb, uid, odooPassword, model, method, args, kwargs]
    },
    id: Date.now()
  };

  const res = await fetch(`${odooUrl.replace(/\/+$/g, '')}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Odoo RPC failed (HTTP ${res.status})`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(json.error?.data?.message || json.error?.message || 'Unknown Odoo RPC error');
  }

  return json.result;
};

const fetchProductCategories = async (uid, productIds) => {
  if (!productIds.length) {
    return new Map();
  }

  const map = new Map();
  const chunks = chunkArray(productIds, 200);

  for (const chunk of chunks) {
    const products = await callOdoo(uid, 'product.product', 'read', [chunk, ['id', 'categ_id']]);
    products.forEach((product) => {
      if (!product?.id) return;
      const categoryName = Array.isArray(product.categ_id) ? product.categ_id[1] : undefined;
      if (categoryName) {
        map.set(product.id, categoryName);
      }
    });
  }

  return map;
};

const parseProductId = (row) => {
  try {
    if (!row?.notes) return null;
    const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes;
    if (notes && notes.product_id) {
      return Number(notes.product_id);
    }
  } catch (error) {
    console.warn(`Failed to parse notes for row ${row.id}:`, error.message);
  }
  return row?.product_code ? Number(row.product_code) : null;
};

const run = async () => {
  const uid = await authenticateWithOdoo();
  console.log('Authenticated with Odoo as uid', uid);

  const BATCH_SIZE = 200;
  let lastId = null;
  let totalUpdated = 0;

  while (true) {
    let query = supabase
      .from('external_inventory_management')
      .select('id, product_code, sub_category, notes')
      .eq('external_source', 'newsyncodoo')
      .eq('sub_category', 'General')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    lastId = data[data.length - 1].id;

    const rowsWithProducts = data.map((row) => ({
      ...row,
      productId: parseProductId(row)
    })).filter((row) => typeof row.productId === 'number' && !Number.isNaN(row.productId));

    if (!rowsWithProducts.length) {
      continue;
    }

    const uniqueProductIds = Array.from(new Set(rowsWithProducts.map((row) => row.productId)));
    const categoryMap = await fetchProductCategories(uid, uniqueProductIds);

    const updates = rowsWithProducts
      .map((row) => {
        const category = categoryMap.get(row.productId);
        if (!category) {
          return null;
        }

        return {
          id: row.id,
          category,
          sub_category: category
        };
      })
      .filter(Boolean);

    if (!updates.length) {
      console.log(`No categories found for batch ending with id ${lastId}`);
      continue;
    }

    const chunks = chunkArray(updates, 300);
    for (const chunk of chunks) {
      const { error: updateError } = await supabase
        .from('external_inventory_management')
        .upsert(chunk, { onConflict: 'id' });

      if (updateError) {
        throw updateError;
      }

      totalUpdated += chunk.length;
      console.log(`Updated ${chunk.length} rows (running total: ${totalUpdated})`);
    }
  }

  console.log(`Backfill complete. Updated ${totalUpdated} rows.`);
};

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
