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

async function buildPdf(data: PdfData): Promise<Blob | null> {
  const jspdfModule = await import(/* @vite-ignore */ 'jspdf');
  const JsPDF = (jspdfModule as any).default ?? (jspdfModule as any).jsPDF;
  const doc = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297;
  const ML = 14, MR = 14, MT = 12;
  const CW = PW - ML - MR; // 182 mm

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

  // Helvetica helpers — standard PDF Type 1 font, present in every viewer
  const hv = (style: 'normal' | 'bold' | 'italic' = 'normal', size = 10) => {
    doc.setFont('helvetica', style);
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
    const vals = [
      String(i + 1),
      item.productName,
      `${item.color}, ${item.size}`,
      `LKR ${item.unitPrice.toLocaleString()}`,
      String(item.quantity),
      `LKR ${item.total.toLocaleString()}`,
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
