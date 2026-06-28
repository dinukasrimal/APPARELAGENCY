const SUPABASE_URL = 'https://ejpwmgluazqcczrpwjlo.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? '';

async function query(table: string, filter: Record<string, string>, select = '*') {
  const params = new URLSearchParams({ select });
  for (const [k, v] of Object.entries(filter)) params.set(k, `eq.${v}`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  return res.json();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response('<h2>Missing invoice ID</h2>', { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const [invoices, items] = await Promise.all([
    query('invoices', { id }, 'id,invoice_number,customer_name,subtotal,discount_amount,total,created_at,agency_id'),
    query('invoice_items', { invoice_id: id }, 'product_name,color,size,quantity,unit_price,total'),
  ]);

  if (!invoices || invoices.length === 0) {
    return new Response('<h2>Invoice not found</h2>', { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  const inv = invoices[0];
  const agencyRows = await query('agencies', { id: inv.agency_id }, 'name,phone,address');
  const agency = agencyRows?.[0] ?? { name: 'Agency', phone: '', address: '' };

  const date = new Date(inv.created_at).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
  const fmt = (n: number) => `LKR ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  const rows = (items ?? []).map((it: any) => `
    <tr>
      <td>${it.product_name}</td>
      <td>${it.color || '-'}</td>
      <td>${it.size || '-'}</td>
      <td style="text-align:right">${it.quantity}</td>
      <td style="text-align:right">${fmt(it.unit_price)}</td>
      <td style="text-align:right">${fmt(it.total)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${inv.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 700px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.10); }
    .header { background: #1a1a2e; color: #fff; padding: 28px 32px; }
    .header h1 { font-size: 22px; font-weight: 700; }
    .header p { font-size: 13px; opacity: .75; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid #eee; flex-wrap: wrap; gap: 16px; }
    .meta-block h3 { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: .5px; }
    .meta-block p { font-size: 14px; font-weight: 600; }
    .meta-block .sub { font-size: 13px; font-weight: 400; color: #555; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8f8f8; font-size: 12px; text-transform: uppercase; color: #666; padding: 10px 16px; text-align: left; border-bottom: 2px solid #eee; }
    th:last-child, td:last-child { text-align: right; padding-right: 32px; }
    th:first-child, td:first-child { padding-left: 32px; }
    td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    .totals { padding: 20px 32px; border-top: 2px solid #eee; }
    .total-row { display: flex; justify-content: flex-end; gap: 48px; font-size: 14px; margin-bottom: 8px; color: #555; }
    .total-row.grand { font-size: 17px; font-weight: 700; color: #1a1a2e; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #aaa; background: #fafafa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${agency.name}</h1>
      <p>${agency.address || ''}${agency.phone ? ' · ' + agency.phone : ''}</p>
    </div>
    <div class="meta">
      <div class="meta-block">
        <h3>Invoice</h3>
        <p>${inv.invoice_number}</p>
        <p class="sub">${date}</p>
      </div>
      <div class="meta-block">
        <h3>Bill To</h3>
        <p>${inv.customer_name}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Color</th>
          <th>Size</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      ${inv.discount_amount > 0 ? `<div class="total-row"><span>Discount</span><span>- ${fmt(inv.discount_amount)}</span></div>` : ''}
      <div class="total-row grand"><span>Total</span><span>${fmt(inv.total)}</span></div>
    </div>
    <div class="footer">Thank you for your business!</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
