import { useEffect } from 'react';
import { Invoice, SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import companyLogo from '../../../assets/icon.png';

interface PrintableInvoiceProps {
  invoice: Invoice;
  salesOrder?: SalesOrder | null;
  onClose: () => void;
}

const PrintableInvoice = ({ invoice, salesOrder, onClose }: PrintableInvoiceProps) => {
  const { toast } = useToast();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      // On native (Android/iOS): generate PDF, save to cache, share via system share sheet
      if (Capacitor.getPlatform() !== 'web') {
        const printableContent = document.querySelector('.print-container') as HTMLElement | null;
        if (!printableContent) throw new Error('Printable content not found');

        // Lazy-load PDF deps only when needed
        const [jspdfModule, html2canvas] = await Promise.all([
          import(/* @vite-ignore */ 'jspdf'),
          import(/* @vite-ignore */ 'html2canvas').then(m => (m as any).default ? (m as any).default : (m as any))
        ]);
        const JsPDF: any = (jspdfModule as any).default || (jspdfModule as any).jsPDF;

        // Render element to image and paginate to PDF (mobile-friendly and memory-safe)
        const canvas = await (html2canvas as any)(printableContent, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new JsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }

        const dataUri = pdf.output('datauristring') as string;
        const base64 = dataUri.split(',')[1];
        const filename = `invoice-${invoice.invoiceNumber || invoice.id}.pdf`;

        // Dynamically import Capacitor plugins only on native to avoid Vite resolution in web
        const { Filesystem, Directory } = await import(/* @vite-ignore */ '@capacitor/filesystem');
        const { Share } = await import(/* @vite-ignore */ '@capacitor/share');

        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `Invoice ${invoice.invoiceNumber}`,
          text: `Invoice ${invoice.invoiceNumber} for ${invoice.customerName}`,
          files: [writeResult.uri],
          dialogTitle: 'Share Invoice PDF',
        });

        toast({ title: 'Shared', description: 'Invoice PDF ready to share.' });
        return;
      }

      // Create a new window for PDF generation
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups for PDF download.');
      }

      // Get the printable content
      const printableContent = document.querySelector('.print-container');
      if (!printableContent) {
        throw new Error('Printable content not found');
      }

      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
              font-size: 12px;
              line-height: 1.4;
              color: #333;
              background: #ffffff;
              display: flex;
              justify-content: center;
            }
            .invoice-container { 
              width: 210mm; 
              min-height: 297mm;
              margin: 0 auto; 
              background: white;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 20px; 
              margin-bottom: 20px; 
            }
            .company-logo {
              height: 80px;
              margin-bottom: 10px;
              object-fit: contain;
            }
            .company-name { 
              font-size: 24px; 
              font-weight: bold; 
              margin-bottom: 10px; 
            }
            .invoice-details { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 20px; 
            }
            .invoice-details > div { 
              flex: 1; 
            }
            .items-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            .items-table th, .items-table td { 
              border: 1px solid #333; 
              padding: 8px; 
              text-align: left; 
            }
            .items-table th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
            }
            .items-table td:nth-child(4), 
            .items-table td:nth-child(5), 
            .items-table td:nth-child(6) { 
              text-align: right; 
            }
            .totals { 
              text-align: right; 
              margin-bottom: 20px; 
            }
            .totals-table { 
              margin-left: auto; 
              width: 300px; 
            }
            .totals-table td { 
              padding: 5px 10px; 
              border: none; 
            }
            .total-row { 
              font-weight: bold; 
              font-size: 14px; 
              border-top: 1px solid #333; 
            }
            .signature-section { 
              border-top: 1px solid #333; 
              padding-top: 20px; 
              text-align: right; 
            }
            .signature-image { 
              max-width: 200px; 
              max-height: 60px; 
              border-bottom: 1px solid #333; 
            }
            .footer { 
              margin-top: 20px; 
              font-size: 10px; 
              color: #666; 
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <img src="${companyLogo}" alt="DAG Clothing Logo" class="company-logo" />
              <div class="company-name">DAG Clothing Pvt Ltd</div>
              <div>Dag clothing Pvt Ltd Kandamuduna Thalalla Matara</div>
              <div>Phone: 0412259525 | Website: www.dag.lk</div>
              <div>Email: order@dag-apparel.com</div>
            </div>
            
            <div class="invoice-details">
              <div>
                <h2 style="margin: 0 0 15px 0; font-size: 18px;">INVOICE</h2>
                <div><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</div>
                <div><strong>Date:</strong> ${invoice.createdAt.toLocaleDateString()}</div>
                ${invoice.salesOrderId ? `<div><strong>Sales Order:</strong> ${invoice.salesOrderId}</div>` : ''}
                <div><strong>Agency:</strong> ${invoice.agencyName}</div>
              </div>
              <div>
                <h3 style="margin: 0 0 10px 0; font-size: 14px;">Bill To:</h3>
                <div><strong>${invoice.customerName}</strong></div>
                <div>Customer ID: ${invoice.customerId}</div>
              </div>
            </div>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Color/Size</th>
                  <th>Unit Price</th>
                  <th>Quantity</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.productName}</td>
                    <td>${item.color}, ${item.size}</td>
                    <td>LKR ${item.unitPrice.toLocaleString()}</td>
                    <td>${item.quantity}</td>
                    <td>LKR ${item.total.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals">
              <table class="totals-table">
                <tr>
                  <td>Subtotal:</td>
                  <td>LKR ${invoice.subtotal.toLocaleString()}</td>
                </tr>
                <tr style="color: green;">
                  <td>Discount:</td>
                  <td>-LKR ${invoice.discountAmount.toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                  <td>Total Amount:</td>
                  <td>LKR ${invoice.total.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div class="signature-section">
              <div style="margin-bottom: 10px;">Customer Signature</div>
              ${invoice.signature ? 
                `<img src="${invoice.signature}" alt="Customer Signature" class="signature-image" />` : 
                '<div style="width: 200px; height: 60px; border-bottom: 1px solid #333; margin-left: auto;"></div>'
              }
            </div>
            
            <div class="footer">
              <div>Invoice generated on: ${new Date().toLocaleString()}</div>
              <div>GPS Location: ${invoice.gpsCoordinates.latitude.toFixed(6)}, ${invoice.gpsCoordinates.longitude.toFixed(6)}</div>
              ${salesOrder ? `<div>Original Order Date: ${salesOrder.createdAt.toLocaleString()}</div>` : ''}
            </div>
          </div>
        </body>
        </html>
      `;

      // Write content to the new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print dialog
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      };

      toast({
        title: 'PDF Download Initiated',
        description: 'Invoice PDF will be downloaded shortly',
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      if (Capacitor.getPlatform() !== 'web') {
        // Fallback to system print dialog on native
        try {
          window.print();
          toast({ title: 'Fallback Print', description: 'Use Save/Share as PDF from system dialog.' });
          return;
        } catch {}
      }
      toast({
        title: 'PDF Download Failed',
        description: error instanceof Error ? error.message : 'Failed to generate PDF',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    // Enhanced print styles to hide everything except the printable content
    const printStyles = `
      @media print {
        /* Hide everything by default */
        body * { 
          visibility: hidden !important; 
        }
        
        /* Show only the printable container and its children */
        .print-container, .print-container * { 
          visibility: visible !important; 
        }
        
        /* Hide non-print elements */
        .no-print, .no-print * { 
          display: none !important; 
          visibility: hidden !important;
        }
        
        /* Show print-only elements */
        .print-only { 
          display: block !important; 
          visibility: visible !important;
        }
        
        /* Reset body and page styles for printing */
        body { 
          margin: 0 !important; 
          padding: 0 !important; 
          background: white !important;
          font-size: 12pt !important;
        }
        
        /* Position the printable container properly */
        .print-container { 
          position: relative !important;
          width: 210mm !important;
          min-height: 297mm !important;
          box-shadow: none !important;
          border: none !important;
          margin: 0 auto !important;
          padding: 20px !important;
          background: white !important;
          page-break-inside: avoid;
        }
        
        /* Hide any navigation, sidebars, headers */
        nav, header, aside, .sidebar, .menu, .navigation {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Ensure table formatting is preserved */
        table {
          border-collapse: collapse !important;
          width: 100% !important;
        }
        
        th, td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          text-align: left !important;
        }
        
        th {
          background-color: #f0f0f0 !important;
          font-weight: bold !important;
        }
      }
      
      @media screen {
        .print-only { 
          display: none; 
        }
      }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);
    
    return () => {
      if (document.head.contains(styleSheet)) {
        document.head.removeChild(styleSheet);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print Controls - Hidden during print */}
      <div className="no-print bg-white border-b px-6 py-4 flex justify-between items-center">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleDownloadPDF} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
            <Download className="h-4 w-4 mr-2" />
            {Capacitor.getPlatform() !== 'web' ? 'Share/Save PDF' : 'Download PDF'}
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Printable Invoice */}
      <div className="print-container mx-auto bg-white p-8 shadow-lg w-[210mm] max-w-full min-h-[297mm]" style={{ width: '210mm', minHeight: '297mm' }}>
        {/* Company Header */}
        <div className="text-center border-b pb-6 mb-6 flex flex-col items-center gap-4">
          <img src={companyLogo} alt="DAG Clothing Logo" className="h-20 w-auto" />
          <h1 className="text-3xl font-bold text-gray-800">DAG Clothing Pvt Ltd</h1>
          <p className="text-gray-600 mt-2">Dag clothing Pvt Ltd Kandamuduna Thalalla Matara</p>
          <p className="text-gray-600">Phone: 0412259525 | Website: www.dag.lk</p>
          <p className="text-gray-600">Email: order@dag-apparel.com</p>
        </div>

        {/* Invoice Header */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">INVOICE</h2>
            <div className="space-y-2">
              <p><span className="font-semibold">Invoice Number:</span> {invoice.invoiceNumber}</p>
              <p><span className="font-semibold">Date:</span> {invoice.createdAt.toLocaleDateString()}</p>
              {invoice.salesOrderId && (
                <p><span className="font-semibold">Sales Order:</span> {invoice.salesOrderId}</p>
              )}
              <p><span className="font-semibold">Agency:</span> {invoice.agencyName}</p>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Bill To:</h3>
            <div className="space-y-1">
              <p className="font-semibold">{invoice.customerName}</p>
              <p className="text-gray-600">Customer ID: {invoice.customerId}</p>
            </div>
          </div>
        </div>

        {/* Items Table - Ensure all product details are visible */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">#</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Color/Size</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Quantity</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.productName}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.color}, {item.size}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">LKR {item.unitPrice.toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">LKR {item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            <div className="space-y-2">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>LKR {invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-green-600">
                <span>Discount:</span>
                <span>-LKR {invoice.discountAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-bold border-t border-gray-300">
                <span>Total Amount:</span>
                <span>LKR {invoice.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-6 mt-8">
          <div className="text-right">
            <div className="mb-4">
              <p className="text-sm text-gray-600">Customer Signature</p>
              {invoice.signature ? (
                <div className="mt-2">
                  <img 
                    src={invoice.signature} 
                    alt="Customer Signature" 
                    className="w-48 h-16 object-contain border-b border-gray-400 ml-auto"
                  />
                </div>
              ) : (
                <div className="mt-8 border-b border-gray-400 w-48 ml-auto"></div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-xs text-gray-500">
          <p>Invoice generated on: {new Date().toLocaleString()}</p>
          <p>GPS Location: {invoice.gpsCoordinates.latitude.toFixed(6)}, {invoice.gpsCoordinates.longitude.toFixed(6)}</p>
          {salesOrder && (
            <p>Original Order Date: {salesOrder.createdAt.toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintableInvoice;
