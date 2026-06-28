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
  customerId?: string;
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
// Inline logo as a public URL — same image used in PrintableInvoice
const LOGO_URL = `${window.location.origin}/icon.png`;

function buildHtml(data: PdfData): string {
  const itemRows = data.items.map((item, i) => `
    <tr>
      <td style="border:1px solid #333;padding:8px">${i + 1}</td>
      <td style="border:1px solid #333;padding:8px">${item.productName}</td>
      <td style="border:1px solid #333;padding:8px">${item.color}, ${item.size}</td>
      <td style="border:1px solid #333;padding:8px;text-align:right">LKR ${item.unitPrice.toLocaleString()}</td>
      <td style="border:1px solid #333;padding:8px;text-align:right">${item.quantity}</td>
      <td style="border:1px solid #333;padding:8px;text-align:right">LKR ${item.total.toLocaleString()}</td>
    </tr>`).join('');

  return `
    <div style="width:794px;background:#fff;padding:37px 45px;font-family:Arial,sans-serif;font-size:12px;color:#333;line-height:1.4">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="${LOGO_URL}" alt="Logo" style="height:48px;object-fit:contain" crossorigin="anonymous" />
          <div>
            <div style="font-size:22px;font-weight:bold;margin-bottom:4px">${COMPANY_NAME}</div>
            <div style="font-size:11px;color:#555">${COMPANY_ADDRESS}</div>
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:#555;line-height:1.8">
          <div>Phone: ${COMPANY_PHONE}</div>
          <div>Email: ${COMPANY_EMAIL}</div>
          <div>Website: ${COMPANY_WEBSITE}</div>
        </div>
      </div>

      <!-- Invoice/Order Meta -->
      <div style="display:flex;justify-content:space-between;margin-bottom:20px">
        <div>
          <h2 style="margin:0 0 12px;font-size:18px">${data.docType}</h2>
          <div><strong>${data.docType === 'INVOICE' ? 'Invoice' : data.docType === 'PURCHASE ORDER' ? 'PO' : 'Order'} Number:</strong> ${data.docNumber}</div>
          <div><strong>Date:</strong> ${data.date}</div>
          ${data.salesOrderId ? `<div><strong>Sales Order:</strong> ${data.salesOrderId}</div>` : ''}
          <div><strong>Agency:</strong> ${data.agencyName}</div>
        </div>
        <div>
          <h3 style="margin:0 0 8px;font-size:14px">Bill To:</h3>
          <div style="font-weight:bold">${data.customerName}</div>
          ${data.customerId ? `<div style="color:#666">Customer ID: ${data.customerId}</div>` : ''}
        </div>
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="border:1px solid #333;padding:8px;text-align:left">#</th>
            <th style="border:1px solid #333;padding:8px;text-align:left">Product</th>
            <th style="border:1px solid #333;padding:8px;text-align:left">Color/Size</th>
            <th style="border:1px solid #333;padding:8px;text-align:right">Unit Price</th>
            <th style="border:1px solid #333;padding:8px;text-align:right">Quantity</th>
            <th style="border:1px solid #333;padding:8px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
        <table style="width:300px">
          <tr><td style="padding:5px 10px">Subtotal:</td><td style="padding:5px 10px;text-align:right">LKR ${data.subtotal.toLocaleString()}</td></tr>
          ${data.discountAmount > 0 ? `<tr style="color:green"><td style="padding:5px 10px">Discount:</td><td style="padding:5px 10px;text-align:right">-LKR ${data.discountAmount.toLocaleString()}</td></tr>` : ''}
          <tr style="font-weight:bold;font-size:14px;border-top:1px solid #333">
            <td style="padding:8px 10px">Total Amount:</td>
            <td style="padding:8px 10px;text-align:right">LKR ${data.total.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="margin-top:24px;font-size:10px;color:#888">
        <div>Generated on: ${new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</div>
        ${data.gpsLat != null ? `<div>GPS Location: ${data.gpsLat.toFixed(6)}, ${data.gpsLng?.toFixed(6)}</div>` : ''}
      </div>
    </div>`;
}

async function renderHtmlToPdfBlob(html: string): Promise<Blob | null> {
  const [jspdfModule, h2cModule] = await Promise.all([
    import(/* @vite-ignore */ 'jspdf'),
    import(/* @vite-ignore */ 'html2canvas').then(m => (m as any).default ?? (m as any)),
  ]);
  const JsPDF = (jspdfModule as any).default ?? (jspdfModule as any).jsPDF;

  // Mount off-screen
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);
  const el = container.firstElementChild as HTMLElement;

  try {
    const canvas = await (h2cModule as any)(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new JsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let left = imgH;
    let pos = 0;
    pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH, undefined, 'FAST');
    left -= pageH;
    while (left > 0) {
      pos = left - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, pos, imgW, imgH, undefined, 'FAST');
      left -= pageH;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
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
  // Cache-bust so SMS recipients always open the latest version
  return `${data.publicUrl}?t=${Date.now()}`;
}

export interface InvoicePdfData {
  invoiceId: string;
  invoiceNumber: string;
  salesOrderId?: string;
  customerName: string;
  customerId?: string;
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
  customerId?: string;
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
    const html = buildHtml({ docId: data.invoiceId, docType: 'INVOICE', docNumber: data.invoiceNumber, ...data });
    const blob = await renderHtmlToPdfBlob(html);
    if (!blob) return null;
    return uploadPdf(blob, `invoices/${data.invoiceId}.pdf`);
  } catch (err) {
    console.error('[PDF] Invoice error:', err);
    return null;
  }
}

export async function generateAndUploadSalesOrderPdf(data: SalesOrderPdfData): Promise<string | null> {
  try {
    const html = buildHtml({ docId: data.orderId, docType: 'SALES ORDER', docNumber: data.orderNumber, ...data });
    const blob = await renderHtmlToPdfBlob(html);
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
    const html = buildHtml({
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
    const blob = await renderHtmlToPdfBlob(html);
    if (!blob) return null;
    return uploadPdf(blob, `purchase-orders/${data.purchaseOrderId}.pdf`);
  } catch (err) {
    console.error('[PDF] Purchase order error:', err);
    return null;
  }
}
