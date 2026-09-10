import { supabase } from '@/integrations/supabase/client';

type LineItem = {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

interface PdfData {
  docId: string;
  docType: 'INVOICE' | 'SALES ORDER' | 'PURCHASE ORDER';
  docNumber: string;
  salesOrderId?: string;
  customerName: string;
  customerAddress?: string;
  agencyName: string;
  date: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  gpsLat?: number;
  gpsLng?: number;
}

const COMPANY_NAME = 'DAG Clothing Pvt Ltd';
const COMPANY_ADDRESS = 'Dag clothing Pvt Ltd Kandamuduna Thalalla Matara';
const COMPANY_PHONE = '0412259525';
const COMPANY_EMAIL = 'order@dag-apparel.com';
const COMPANY_WEBSITE = 'www.dag.lk';
const LOGO_URL = `${window.location.origin}/icon.png`;

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

async function fetchLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Inter font TTF files via jsDelivr (MIT licensed, freely embeddable).
// Must be raw TTF, not WOFF — jsPDF's addFont() has no WOFF decompression
// support, so a WOFF file parses as garbage and throws "Cannot read
// properties of undefined (reading 'widths')" the first time it's measured.
const FONT_REGULAR_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.0.16/latin-400-normal.ttf';
const FONT_BOLD_URL    = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.0.16/latin-700-normal.ttf';

async function buildPdf(data: PdfData): Promise<Blob | null> {
  const jspdfModule = await import(/* @vite-ignore */ 'jspdf');
  const JsPDF = (jspdfModule as any).default ?? (jspdfModule as any).jsPDF;
  const doc = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297;
  const ML = 14, MR = 14, MT = 12;
  const CW = PW - ML - MR; // 182 mm

  // Embed Inter font (MIT licensed) so every viewer/printer uses exactly this font.
  // Falls back to built-in helvetica if CDN is unreachable.
  const [regularB64, boldB64] = await Promise.all([
    fetchAsBase64(FONT_REGULAR_URL),
    fetchAsBase64(FONT_BOLD_URL),
  ]);

  let fontName = 'helvetica';
  if (regularB64 && boldB64) {
    try {
      doc.addFileToVFS('Inter-Regular.ttf', regularB64);
      doc.addFileToVFS('Inter-Bold.ttf', boldB64);
      doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
      doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
      fontName = 'Inter';
    } catch (_) {
      fontName = 'helvetica';
    }
  }

  // Column definitions — widths must sum to CW (182)
  const cols = [
    { label: '#',            w: 8,  align: 'left'  as const },
    { label: 'Product',      w: 67, align: 'left'  as const },
    { label: 'Color / Size', w: 37, align: 'left'  as const },
    { label: 'Unit Price',   w: 28, align: 'right' as const },
    { label: 'Qty',          w: 14, align: 'right' as const },
    { label: 'Total',        w: 28, align: 'right' as const },
  ];

  const PAD = 2;
  const ROW_H = 6.5;
  const HDR_H = 7;

  // Font helper — uses embedded Inter when available, falls back to helvetica
  const hv = (style: 'normal' | 'bold' | 'italic' = 'normal', size = 10) => {
    const s = style === 'italic' ? 'normal' : style; // Inter has no italic subset loaded
    doc.setFont(fontName, s);
    doc.setFontSize(size);
  };
  const rgb = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  let y = MT;

  // ── LOGO ────────────────────────────────────────────────────────────────
  const logo = await fetchLogoBase64();
  if (logo) {
    try { doc.addImage(logo, 'PNG', ML, y, 18, 18); } catch (_) { /* skip if format unsupported */ }
  }

  hv('bold', 14);
  rgb(33, 33, 33);
  doc.text(COMPANY_NAME, ML + 22, y + 6);

  hv('normal', 8.5);
  rgb(90, 90, 90);
  doc.text(COMPANY_ADDRESS, ML + 22, y + 12);

  // Contact info — right aligned
  hv('normal', 8.5);
  [`Phone: ${COMPANY_PHONE}`, `Email: ${COMPANY_EMAIL}`, `Web:   ${COMPANY_WEBSITE}`]
    .forEach((line, i) => doc.text(line, PW - MR, y + 5 + i * 5, { align: 'right' }));

  rgb(33, 33, 33);
  y += 23;

  // Header divider
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.6);
  doc.line(ML, y, PW - MR, y);
  y += 7;

  // ── DOC TYPE + META ─────────────────────────────────────────────────────
  hv('bold', 16);
  doc.text(data.docType, ML, y);
  y += 7;

  const numLabel = data.docType === 'INVOICE' ? 'Invoice No:' : data.docType === 'PURCHASE ORDER' ? 'PO Number:' : 'Order No:';
  const metaRows: [string, string][] = [
    [numLabel, data.docNumber],
    ['Date:', data.date],
    ['Agency:', data.agencyName],
    ...(data.salesOrderId ? [['Sales Order:', data.salesOrderId] as [string, string]] : []),
  ];

  const metaStartY = y;
  for (const [label, val] of metaRows) {
    hv('bold', 9.5); rgb(51, 51, 51);
    doc.text(label, ML, y);
    hv('normal', 9.5);
    doc.text(val, ML + 34, y);
    y += 5.5;
  }

  // ── BILL TO — right column ───────────────────────────────────────────────
  const billX = ML + CW * 0.53;
  let bY = metaStartY;
  hv('bold', 10); rgb(51, 51, 51);
  doc.text('Bill To:', billX, bY); bY += 5.5;
  hv('bold', 9.5);
  doc.text(data.customerName, billX, bY);
  if (data.customerAddress) {
    bY += 5;
    hv('normal', 9); rgb(102, 102, 102);
    doc.text(data.customerAddress, billX, bY);
    rgb(51, 51, 51);
  }

  y += 5;

  // ── ITEMS TABLE ─────────────────────────────────────────────────────────
  const drawHeader = (startY: number): number => {
    doc.setFillColor(240, 240, 240);
    doc.rect(ML, startY, CW, HDR_H, 'F');
    doc.setDrawColor(51, 51, 51);
    doc.setLineWidth(0.25);
    hv('bold', 9);
    let cx = ML;
    for (const col of cols) {
      doc.rect(cx, startY, col.w, HDR_H);
      const tx = col.align === 'right' ? cx + col.w - PAD : cx + PAD;
      doc.text(col.label, tx, startY + 4.8, { align: col.align });
      cx += col.w;
    }
    return startY + HDR_H;
  };

  y = drawHeader(y);
  doc.setLineWidth(0.25);

  for (let i = 0; i < data.items.length; i++) {
    if (y + ROW_H > PH - 55) {
      doc.addPage();
      y = MT;
      y = drawHeader(y);
    }

    const item = data.items[i];
    // Coerce every cell to a string so no undefined/null field can reach
    // doc.text() (which throws) — guards against edge-case item data.
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
    const vals = [
      String(i + 1),
      String(item.productName ?? ''),
      `${item.color ?? ''}, ${item.size ?? ''}`,
      `LKR ${num(item.unitPrice).toLocaleString()}`,
      String(item.quantity ?? 0),
      `LKR ${num(item.total).toLocaleString()}`,
    ];

    hv('normal', 9);
    let cx = ML;
    for (let c = 0; c < cols.length; c++) {
      doc.rect(cx, y, cols[c].w, ROW_H);
      const maxW = cols[c].w - PAD * 2;
      let val = vals[c];
      while (doc.getTextWidth(val) > maxW && val.length > 1) val = val.slice(0, -1);
      if (val !== vals[c]) val = val.slice(0, -1) + '…';
      const tx = cols[c].align === 'right' ? cx + cols[c].w - PAD : cx + PAD;
      doc.text(val, tx, y + 4.3, { align: cols[c].align });
      cx += cols[c].w;
    }
    y += ROW_H;
  }

  y += 4;

  // ── GENERATED / GPS ─────────────────────────────────────────────────────
  hv('normal', 7.5); rgb(140, 140, 140);
  doc.text(`Generated: ${new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}`, ML, y);
  y += 4;
  if (data.gpsLat != null) {
    doc.text(`GPS: ${data.gpsLat.toFixed(6)}, ${data.gpsLng?.toFixed(6)}`, ML, y);
    y += 4;
  }
  rgb(51, 51, 51);

  // ── TOTALS ──────────────────────────────────────────────────────────────
  const totX = PW - MR - 76;
  hv('normal', 10);
  doc.text('Subtotal:', totX, y);
  doc.text(`LKR ${data.subtotal.toLocaleString()}`, PW - MR, y, { align: 'right' });
  y += 6;

  if (data.discountAmount > 0) {
    rgb(0, 120, 0);
    doc.text('Discount:', totX, y);
    doc.text(`-LKR ${data.discountAmount.toLocaleString()}`, PW - MR, y, { align: 'right' });
    rgb(51, 51, 51);
    y += 6;
  }

  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.3);
  doc.line(totX, y, PW - MR, y);
  y += 5;

  hv('bold', 12);
  doc.text('Total Amount:', totX, y);
  doc.text(`LKR ${data.total.toLocaleString()}`, PW - MR, y, { align: 'right' });
  y += 12;

  // ── SIGNATURE BLOCK ─────────────────────────────────────────────────────
  if (y + 34 > PH - MT) { doc.addPage(); y = MT; }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
  y += 7;

  hv('normal', 8.5); rgb(85, 85, 85);
  doc.text('Customer Signature', ML, y);
  doc.text('Authorized Signature', PW - MR, y, { align: 'right' });
  y += 20;

  // Dotted signing lines
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  try { (doc as any).setLineDashPattern([1, 1.5], 0); } catch (_) {}
  doc.line(ML, y, ML + 74, y);
  doc.line(PW - MR - 74, y, PW - MR, y);
  try { (doc as any).setLineDashPattern([], 0); } catch (_) {}
  y += 5;

  hv('normal', 8.5); rgb(85, 85, 85);
  doc.text('Name: ___________________________', ML, y);
  y += 5;
  doc.text('Date:  ___________________________', ML, y);
  doc.text(data.agencyName, PW - MR, y - 5, { align: 'right' });

  rgb(51, 51, 51);

  return doc.output('blob');
}

// ── PLAIN-TEXT INVOICE (for dot-matrix / RAWBT printing) ────────────────────
// Generates a fixed-width ASCII text invoice suitable for Epson LQ-310 via
// RAWBT.  Plain text always prints correctly on dot-matrix; PDF image
// approaches can fail due to RAWBT code-page mismatches.

export function generatePlainTextInvoice(data: InvoicePdfData): string {
  const W = 76; // safe column width for 80-col continuous paper
  const DIVIDER = '='.repeat(W);
  const LINE    = '-'.repeat(W);
  const fmt     = (n: number) => n.toLocaleString('en-US');
  const a       = (s: string) => String(s ?? '').replace(/[^\x20-\x7E]/g, '');
  const padL    = (s: string | number, n: number) => String(s).slice(0, n).padEnd(n);
  const padR    = (s: string | number, n: number) => String(s).slice(0, n).padStart(n);
  const center  = (s: string) => { const p = Math.max(0, Math.floor((W - s.length) / 2)); return ' '.repeat(p) + s; };

  const lines: string[] = [];

  // Header
  lines.push(center('DAG CLOTHING PVT LTD'));
  lines.push(center('Dag Clothing Pvt Ltd Kandamuduna Thalalla Matara'));
  lines.push(center('Tel: 0412259525  Email: order@dag-apparel.com'));
  lines.push(DIVIDER);
  lines.push('');

  // Doc type
  const docLabel = 'INVOICE';
  lines.push(docLabel);
  lines.push('');
  lines.push(`Invoice No  : ${a(data.invoiceNumber)}`);
  lines.push(`Date        : ${a(data.date)}`);
  lines.push(`Agency      : ${a(data.agencyName)}`);
  if (data.salesOrderId) lines.push(`Sales Order : ${a(data.salesOrderId)}`);
  lines.push('');
  lines.push(`Bill To     : ${a(data.customerName)}`);
  if (data.customerAddress) lines.push(`              ${a(data.customerAddress)}`);
  lines.push('');
  lines.push(DIVIDER);

  // Table header
  // Cols: #(3) Product(22) Color/Size(12) UnitPrice(12) Qty(5) Total(12)  = 66 + 5*2 spaces = 76
  const H_NO    = 3,  H_PROD = 22, H_CS = 12, H_UP = 12, H_QTY = 5, H_TOT = 12;
  const hdr = padL('#', H_NO) + '  ' + padL('Product', H_PROD) + '  ' +
              padL('Color/Size', H_CS) + '  ' + padR('Unit Price', H_UP) + '  ' +
              padR('Qty', H_QTY) + '  ' + padR('Total', H_TOT);
  lines.push(hdr);
  lines.push(LINE);

  data.items.forEach((item, i) => {
    const row = padL(String(i + 1), H_NO) + '  ' +
                padL(a(item.productName), H_PROD) + '  ' +
                padL(`${a(item.color)},${a(item.size)}`, H_CS) + '  ' +
                padR(`LKR ${fmt(item.unitPrice)}`, H_UP) + '  ' +
                padR(String(item.quantity), H_QTY) + '  ' +
                padR(`LKR ${fmt(item.total)}`, H_TOT);
    lines.push(row);
  });

  lines.push(DIVIDER);
  lines.push('');

  // GPS / generated (left, below table)
  const now = new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
  lines.push(`Generated: ${now}`);
  if (data.gpsLat != null) {
    lines.push(`GPS: ${data.gpsLat.toFixed(6)}, ${(data.gpsLng ?? 0).toFixed(6)}`);
  }
  lines.push('');

  // Totals (right-aligned)
  const totLabelW = 20, totValW = 16;
  lines.push(' '.repeat(W - totLabelW - totValW) + padL('Subtotal:', totLabelW) + padR(`LKR ${fmt(data.subtotal)}`, totValW));
  if (data.discountAmount > 0) {
    lines.push(' '.repeat(W - totLabelW - totValW) + padL('Discount:', totLabelW) + padR(`-LKR ${fmt(data.discountAmount)}`, totValW));
  }
  lines.push(DIVIDER);
  lines.push(' '.repeat(W - totLabelW - totValW) + padL('TOTAL AMOUNT:', totLabelW) + padR(`LKR ${fmt(data.total)}`, totValW));
  lines.push(DIVIDER);
  lines.push('');
  lines.push('');

  // Signature block
  const sigW = Math.floor(W / 2) - 2;
  lines.push(padL('Customer Signature', sigW) + '  ' + 'Authorized Signature');
  lines.push('');
  lines.push('');
  lines.push('_'.repeat(sigW) + '  ' + '_'.repeat(sigW));
  lines.push('');
  lines.push(padL(`Name: ${'.' .repeat(sigW - 6)}`, sigW) + '  ' + a(data.agencyName));
  lines.push(padL(`Date: ${'.' .repeat(sigW - 6)}`, sigW));
  lines.push('');
  lines.push(DIVIDER);
  lines.push('');

  return lines.join('\n');
}

// ── DOT-MATRIX PDF ──────────────────────────────────────────────────────────
// Renders the invoice to a high-DPI black-and-white raster image so RAWBT
// doesn't need to interpret fonts at all.  The resulting PDF contains a single
// PNG image page — nothing for the printer driver to misread.

const ascii = (s: string) => String(s ?? '').replace(/[^\x20-\x7E]/g, '');

function buildDotMatrixHtml(data: PdfData): string {
  const fmt = (n: number) => n.toLocaleString('en-US');
  // TD style — overflow hidden so nothing spills past cell border
  const td = (extra = '') =>
    `border:2px solid #000;padding:5px 6px;overflow:hidden;white-space:nowrap;${extra}`;

  const rows = data.items.map((item, i) => `
    <tr>
      <td style="${td('text-align:center;width:5%')}">${i + 1}</td>
      <td style="${td('width:33%')}">${ascii(item.productName)}</td>
      <td style="${td('width:20%')}">${ascii(item.color)}, ${ascii(item.size)}</td>
      <td style="${td('text-align:right;width:18%')}">LKR ${fmt(item.unitPrice)}</td>
      <td style="${td('text-align:center;width:8%')}">${item.quantity}</td>
      <td style="${td('text-align:right;width:16%')}">LKR ${fmt(item.total)}</td>
    </tr>`).join('');

  const discount = data.discountAmount > 0
    ? `<tr>
         <td style="border:2px solid #000;padding:5px 8px;text-align:right;font-weight:bold" colspan="5">Discount:</td>
         <td style="border:2px solid #000;padding:5px 8px;text-align:right">-LKR ${fmt(data.discountAmount)}</td>
       </tr>`
    : '';

  const now = new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
  const gpsLine = data.gpsLat != null
    ? `<div>GPS: ${data.gpsLat.toFixed(6)}, ${(data.gpsLng ?? 0).toFixed(6)}</div>` : '';
  const addrLine = data.customerAddress
    ? `<div style="margin-top:3px">${ascii(data.customerAddress)}</div>` : '';
  const soLine = data.salesOrderId
    ? `<div><b>Sales Order:</b> ${ascii(data.salesOrderId)}</div>` : '';

  // 794px wide, 14px base font — at 794→210mm scale that gives ~3.7mm (~10.5pt)
  // which is comfortably readable on a dot-matrix print.
  // NOTE: return only the inner div — not a full HTML doc — so container.innerHTML
  // correctly sets firstElementChild to this div for html2canvas.
  return `<div style="width:794px;background:#fff;padding:16px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000;line-height:1.4;box-sizing:border-box">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:12px">
      <div>
        <div style="font-size:20px;font-weight:bold">DAG CLOTHING PVT LTD</div>
        <div style="font-size:13px;margin-top:3px">Dag Clothing Pvt Ltd Kandamuduna Thalalla Matara</div>
      </div>
      <div style="text-align:right;font-size:13px">
        <div>Tel: 0412259525</div>
        <div>Email: order@dag-apparel.com</div>
        <div>www.dag.lk</div>
      </div>
    </div>
    <!-- Doc type + meta -->
    <div style="display:flex;justify-content:space-between;margin-bottom:12px">
      <div style="max-width:48%">
        <div style="font-size:18px;font-weight:bold;margin-bottom:5px">${ascii(data.docType)}</div>
        <div><b>No:</b> ${ascii(data.docNumber)}</div>
        <div><b>Date:</b> ${ascii(data.date)}</div>
        <div><b>Agency:</b> ${ascii(data.agencyName)}</div>
        ${soLine}
      </div>
      <div style="max-width:48%;text-align:right">
        <div style="font-weight:bold;margin-bottom:3px">BILL TO:</div>
        <div style="font-weight:bold;font-size:15px">${ascii(data.customerName)}</div>
        ${addrLine}
      </div>
    </div>
    <!-- Items table — table-layout:fixed prevents any column from expanding -->
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px;margin-bottom:10px">
      <colgroup>
        <col style="width:5%">
        <col style="width:33%">
        <col style="width:20%">
        <col style="width:18%">
        <col style="width:8%">
        <col style="width:16%">
      </colgroup>
      <thead>
        <tr style="background:#000;color:#fff">
          <th style="border:2px solid #000;padding:5px 6px;text-align:center">#</th>
          <th style="border:2px solid #000;padding:5px 6px;text-align:left">Product</th>
          <th style="border:2px solid #000;padding:5px 6px;text-align:left">Color / Size</th>
          <th style="border:2px solid #000;padding:5px 6px;text-align:right">Unit Price</th>
          <th style="border:2px solid #000;padding:5px 6px;text-align:center">Qty</th>
          <th style="border:2px solid #000;padding:5px 6px;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody style="font-size:13px">${rows}</tbody>
    </table>
    <!-- Generated / GPS left-aligned below table -->
    <div style="font-size:11px;margin-bottom:10px">
      <div>Generated: ${now}</div>
      ${gpsLine}
    </div>
    <!-- Totals — right-aligned, 300px wide so values have room -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <table style="border-collapse:collapse;width:300px;font-size:14px">
        <tr>
          <td style="border:2px solid #000;padding:5px 10px">Subtotal:</td>
          <td style="border:2px solid #000;padding:5px 10px;text-align:right">LKR ${fmt(data.subtotal)}</td>
        </tr>
        ${discount}
        <tr>
          <td style="border:3px solid #000;padding:6px 10px;font-weight:bold;font-size:15px">TOTAL:</td>
          <td style="border:3px solid #000;padding:6px 10px;text-align:right;font-weight:bold;font-size:15px">LKR ${fmt(data.total)}</td>
        </tr>
      </table>
    </div>
    <!-- Signature block -->
    <div style="border-top:2px solid #000;padding-top:12px;display:flex;justify-content:space-between">
      <div style="width:46%">
        <div style="font-weight:bold;margin-bottom:32px">Customer Signature</div>
        <div style="border-bottom:2px solid #000"></div>
        <div style="margin-top:6px">Name: ............................................</div>
        <div style="margin-top:5px">Date: ............................................</div>
      </div>
      <div style="width:46%;text-align:right">
        <div style="font-weight:bold;margin-bottom:32px">Authorized Signature</div>
        <div style="border-bottom:2px solid #000"></div>
        <div style="margin-top:6px">${ascii(data.agencyName)}</div>
      </div>
    </div>
  </div>
  </div>`;
}

export async function generateDotMatrixBlob(data: InvoicePdfData): Promise<Blob | null> {
  try {
    const pdfData: PdfData = {
      docId: data.invoiceId,
      docType: 'INVOICE',
      docNumber: data.invoiceNumber,
      salesOrderId: data.salesOrderId,
      customerName: data.customerName,
      customerAddress: data.customerAddress,
      agencyName: data.agencyName,
      date: data.date,
      items: data.items,
      subtotal: data.subtotal,
      discountAmount: data.discountAmount,
      total: data.total,
      gpsLat: data.gpsLat,
      gpsLng: data.gpsLng,
    };

    const html2canvasModule = await import(/* @vite-ignore */ 'html2canvas')
      .then(m => (m as any).default ?? (m as any));
    const jspdfModule = await import(/* @vite-ignore */ 'jspdf');
    const JsPDF = (jspdfModule as any).default ?? (jspdfModule as any).jsPDF;

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:794px;overflow:hidden;background:#fff';
    container.innerHTML = buildDotMatrixHtml(pdfData);
    document.body.appendChild(container);
    // Temporary global style so table-layout:fixed and border-box work in the off-screen div
    const resetStyle = document.createElement('style');
    resetStyle.textContent = '#_dm_tmp *{box-sizing:border-box}';
    container.id = '_dm_tmp';
    document.head.appendChild(resetStyle);
    const el = container.firstElementChild as HTMLElement;

    let blob: Blob | null = null;
    try {
      // Scale 3 ≈ 288 DPI at 96 DPI base; gives crisp dot-matrix output.
      // width + windowWidth pin the render to exactly 794px so nothing bleeds right.
      const canvas = await html2canvasModule(el, {
        scale: 3,
        width: 794,
        windowWidth: 794,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Convert to true black-and-white — threshold at 180 luminance
      const bwCanvas = document.createElement('canvas');
      bwCanvas.width  = canvas.width;
      bwCanvas.height = canvas.height;
      const ctx = bwCanvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, bwCanvas.width, bwCanvas.height);
      ctx.drawImage(canvas, 0, 0);
      const imgData = ctx.getImageData(0, 0, bwCanvas.width, bwCanvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const bw = lum < 180 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = bw;
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      const pngData = bwCanvas.toDataURL('image/png');

      // Continuous-paper page: A4 width, height matches content exactly
      const PAGE_W_MM = 210;
      const PAGE_H_MM = Math.ceil((bwCanvas.height / bwCanvas.width) * PAGE_W_MM) + 4;

      const pdf = new JsPDF({ orientation: 'p', unit: 'mm', format: [PAGE_W_MM, PAGE_H_MM] });
      pdf.addImage(pngData, 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM - 4);
      blob = pdf.output('blob') as Blob;
    } finally {
      document.body.removeChild(container);
      document.head.removeChild(resetStyle);
    }
    return blob;
  } catch (err) {
    console.error('[PDF] Dot-matrix error:', err);
    return null;
  }
}

// ── PRICE LIST PDF ───────────────────────────────────────────────────────
// Category-grouped catalog listing, with agency-specific pricing already
// resolved per product before this is called (see getProductPriceForAgency).

export interface PriceListPdfData {
  customerId: string;
  customerName: string;
  agencyName: string;
  date: string;
  priceTypeLabel: string;
  categories: {
    category: string;
    products: { name: string; color: string; size: string; price: number }[];
  }[];
}

async function buildPriceListPdf(data: PriceListPdfData): Promise<Blob | null> {
  const jspdfModule = await import(/* @vite-ignore */ 'jspdf');
  const JsPDF = (jspdfModule as any).default ?? (jspdfModule as any).jsPDF;
  const doc = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297;
  const ML = 14, MR = 14, MT = 12;
  const CW = PW - ML - MR;

  const [regularB64, boldB64] = await Promise.all([
    fetchAsBase64(FONT_REGULAR_URL),
    fetchAsBase64(FONT_BOLD_URL),
  ]);

  let fontName = 'helvetica';
  if (regularB64 && boldB64) {
    try {
      doc.addFileToVFS('Inter-Regular.ttf', regularB64);
      doc.addFileToVFS('Inter-Bold.ttf', boldB64);
      doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
      doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
      fontName = 'Inter';
    } catch (_) {
      fontName = 'helvetica';
    }
  }

  const hv = (style: 'normal' | 'bold' = 'normal', size = 10) => {
    doc.setFont(fontName, style);
    doc.setFontSize(size);
  };
  const rgb = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  let y = MT;

  const logo = await fetchLogoBase64();
  if (logo) {
    try { doc.addImage(logo, 'PNG', ML, y, 18, 18); } catch (_) { /* skip if format unsupported */ }
  }

  hv('bold', 14); rgb(33, 33, 33);
  doc.text(COMPANY_NAME, ML + 22, y + 6);
  hv('normal', 8.5); rgb(90, 90, 90);
  doc.text(COMPANY_ADDRESS, ML + 22, y + 12);
  hv('normal', 8.5);
  [`Phone: ${COMPANY_PHONE}`, `Email: ${COMPANY_EMAIL}`, `Web:   ${COMPANY_WEBSITE}`]
    .forEach((line, i) => doc.text(line, PW - MR, y + 5 + i * 5, { align: 'right' }));

  rgb(33, 33, 33);
  y += 23;

  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.6);
  doc.line(ML, y, PW - MR, y);
  y += 7;

  hv('bold', 16);
  doc.text('PRICE LIST', ML, y);
  y += 7;

  const metaRows: [string, string][] = [
    ['Date:', data.date],
    ['Agency:', data.agencyName],
    ['Customer:', data.customerName],
    ['Price Type:', data.priceTypeLabel],
  ];
  for (const [label, val] of metaRows) {
    hv('bold', 9.5); rgb(51, 51, 51);
    doc.text(label, ML, y);
    hv('normal', 9.5);
    doc.text(val, ML + 28, y);
    y += 5.5;
  }
  y += 3;

  const cols = [
    { label: 'Product',     w: 90, align: 'left'  as const },
    { label: 'Color',       w: 30, align: 'left'  as const },
    { label: 'Size',        w: 25, align: 'left'  as const },
    { label: 'Price (LKR)', w: 37, align: 'right' as const },
  ];
  const PAD = 2;
  const ROW_H = 6;
  const HDR_H = 7;
  const CAT_H = 8;

  const drawColHeader = (startY: number): number => {
    doc.setFillColor(240, 240, 240);
    doc.rect(ML, startY, CW, HDR_H, 'F');
    doc.setDrawColor(51, 51, 51);
    doc.setLineWidth(0.25);
    hv('bold', 9);
    let cx = ML;
    for (const col of cols) {
      doc.rect(cx, startY, col.w, HDR_H);
      const tx = col.align === 'right' ? cx + col.w - PAD : cx + PAD;
      doc.text(col.label, tx, startY + 4.8, { align: col.align });
      cx += col.w;
    }
    return startY + HDR_H;
  };

  for (const cat of data.categories) {
    if (y + CAT_H + HDR_H + ROW_H > PH - 20) { doc.addPage(); y = MT; }

    doc.setFillColor(51, 51, 51);
    doc.rect(ML, y, CW, CAT_H, 'F');
    hv('bold', 11); rgb(255, 255, 255);
    doc.text(cat.category, ML + PAD, y + 5.7);
    rgb(51, 51, 51);
    y += CAT_H + 2;

    y = drawColHeader(y);
    doc.setLineWidth(0.25);

    for (const p of cat.products) {
      if (y + ROW_H > PH - 20) {
        doc.addPage();
        y = MT;
        y = drawColHeader(y);
      }

      const vals = [p.name ?? '', p.color ?? '', p.size ?? '', p.price.toLocaleString()];
      hv('normal', 9);
      let cx = ML;
      for (let c = 0; c < cols.length; c++) {
        doc.rect(cx, y, cols[c].w, ROW_H);
        const maxW = cols[c].w - PAD * 2;
        let val = String(vals[c]);
        while (doc.getTextWidth(val) > maxW && val.length > 1) val = val.slice(0, -1);
        if (val !== String(vals[c])) val = val.slice(0, -1) + '…';
        const tx = cols[c].align === 'right' ? cx + cols[c].w - PAD : cx + PAD;
        doc.text(val, tx, y + 4.1, { align: cols[c].align });
        cx += cols[c].w;
      }
      y += ROW_H;
    }
    y += 4;
  }

  if (y + 6 > PH - MT) { doc.addPage(); y = MT; }
  hv('normal', 7.5); rgb(140, 140, 140);
  doc.text(`Generated: ${new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}`, ML, y);

  return doc.output('blob');
}

export async function generateAndUploadPriceListPdf(data: PriceListPdfData): Promise<string | null> {
  // Unlike the other generateAndUpload* functions (used fire-and-forget after
  // a toast already fired), this one is awaited directly by its caller, which
  // needs the real failure reason to show the user — so it rethrows instead
  // of swallowing the error.
  const blob = await buildPriceListPdf(data);
  if (!blob) return null;
  return uploadPdf(blob, `price-lists/${data.customerId}.pdf`);
}

async function uploadPdf(blob: Blob, path: string): Promise<string | null> {
  const { error } = await supabase.storage
    .from('invoice-pdfs')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });

  if (error) {
    console.error('[PDF] Upload error:', error.message);
    return null;
  }
  const { data } = supabase.storage.from('invoice-pdfs').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export interface InvoicePdfData {
  invoiceId: string;
  invoiceNumber: string;
  salesOrderId?: string;
  customerName: string;
  customerAddress?: string;
  agencyName: string;
  date: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  gpsLat?: number;
  gpsLng?: number;
}

export interface SalesOrderPdfData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerAddress?: string;
  agencyName: string;
  date: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  gpsLat?: number;
  gpsLng?: number;
}

export async function generateAndUploadInvoicePdf(data: InvoicePdfData): Promise<string | null> {
  try {
    const blob = await buildPdf({ docId: data.invoiceId, docType: 'INVOICE', docNumber: data.invoiceNumber, ...data });
    if (!blob) return null;
    return uploadPdf(blob, `invoices/${data.invoiceId}.pdf`);
  } catch (err) {
    console.error('[PDF] Invoice error:', err);
    return null;
  }
}

export async function generateAndUploadSalesOrderPdf(data: SalesOrderPdfData): Promise<string | null> {
  try {
    const blob = await buildPdf({ docId: data.orderId, docType: 'SALES ORDER', docNumber: data.orderNumber, ...data });
    if (!blob) return null;
    return uploadPdf(blob, `orders/${data.orderId}.pdf`);
  } catch (err) {
    console.error('[PDF] Sales order error:', err);
    return null;
  }
}

export interface PurchaseOrderPdfData {
  purchaseOrderId: string;
  agencyName: string;
  date: string;
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  gpsLat?: number;
  gpsLng?: number;
}

export async function generateAndUploadPurchaseOrderPdf(data: PurchaseOrderPdfData): Promise<string | null> {
  try {
    const blob = await buildPdf({
      docId: data.purchaseOrderId,
      docType: 'PURCHASE ORDER',
      docNumber: data.purchaseOrderId.slice(0, 8).toUpperCase(),
      customerName: data.agencyName,
      agencyName: data.agencyName,
      date: data.date,
      items: data.items,
      subtotal: data.subtotal,
      discountAmount: data.discountAmount,
      total: data.total,
      gpsLat: data.gpsLat,
      gpsLng: data.gpsLng,
    });
    if (!blob) return null;
    return uploadPdf(blob, `purchase-orders/${data.purchaseOrderId}.pdf`);
  } catch (err) {
    console.error('[PDF] Purchase order error:', err);
    return null;
  }
}
