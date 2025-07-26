import { useEffect } from 'react';
import { PurchaseOrder } from '@/types/purchase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

interface PrintablePurchaseOrderProps {
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
}

const PrintablePurchaseOrder = ({ purchaseOrder, onClose }: PrintablePurchaseOrderProps) => {
  const handlePrint = () => {
    window.print();
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
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          max-width: none !important; 
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          padding: 20px !important;
          background: white !important;
        }
        
        /* Ensure page breaks work properly */
        .print-container {
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
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          Print Purchase Order
        </Button>
      </div>

      {/* Printable Purchase Order */}
      <div className="print-container max-w-4xl mx-auto bg-white p-8 shadow-lg">
        {/* Company Header */}
        <div className="text-center border-b pb-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800">DAG Clothing Pvt Ltd</h1>
          <p className="text-gray-600 mt-2">Dag clothing Pvt Ltd Kandamuduna Thalalla Matara</p>
          <p className="text-gray-600">Phone: 0412259525 | Website: www.dag.lk</p>
          <p className="text-gray-600">Email: order@dag-apparel.com</p>
        </div>

        {/* Purchase Order Header */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">PURCHASE ORDER</h2>
            <div className="space-y-2">
              <p><span className="font-semibold">PO Number:</span> {purchaseOrder.id}</p>
              <p><span className="font-semibold">Date:</span> {purchaseOrder.createdAt.toLocaleDateString()}</p>
              <p><span className="font-semibold">Status:</span> <span className="capitalize">{purchaseOrder.status.replace('_', ' ')}</span></p>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Ordered By:</h3>
            <div className="space-y-1">
              <p className="font-semibold">{purchaseOrder.agencyName}</p>
              <p className="text-gray-600">Agency ID: {purchaseOrder.agencyId}</p>
              <p className="text-gray-600">Created By: {purchaseOrder.createdBy}</p>
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
              {purchaseOrder.items.map((item, index) => (
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

        {/* Total */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            <div className="flex justify-between py-2 text-lg font-bold border-t border-gray-300">
              <span>Total Amount:</span>
              <span>LKR {purchaseOrder.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {purchaseOrder.notes && (
          <div className="mb-8">
            <h4 className="font-semibold mb-2">Notes:</h4>
            <p className="text-gray-700 bg-gray-50 p-3 rounded">{purchaseOrder.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-6 mt-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold mb-2">Terms & Conditions:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Delivery within agreed timeline</li>
                <li>• Quality as per specifications</li>
                <li>• Payment terms as agreed</li>
              </ul>
            </div>
            <div className="text-right">
              <div className="mb-4">
                <p className="text-sm text-gray-600">Authorized Signature</p>
                <div className="mt-8 border-b border-gray-400 w-48 ml-auto"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-xs text-gray-500">
          <p>Purchase Order generated on: {new Date().toLocaleString()}</p>
          <p>GPS Location: {purchaseOrder.gpsCoordinates.latitude.toFixed(6)}, {purchaseOrder.gpsCoordinates.longitude.toFixed(6)}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintablePurchaseOrder;
