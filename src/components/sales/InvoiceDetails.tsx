import { Invoice, SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, FileText, ShoppingCart } from 'lucide-react';

interface InvoiceDetailsProps {
  invoice: Invoice;
  salesOrder?: SalesOrder | null;
  onBack: () => void;
  onPrint: () => void;
}

const InvoiceDetails = ({ invoice, salesOrder, onBack, onPrint }: InvoiceDetailsProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
            <p className="text-gray-600">{invoice.id}</p>
          </div>
        </div>
        <Button onClick={onPrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          Print Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-sm text-gray-700">Invoice Number:</span>
                <p className="text-sm font-mono">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Customer:</span>
                <p className="text-sm">{invoice.customerName}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Agency:</span>
                <p className="text-sm">{invoice.agencyId}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created:</span>
                <p className="text-sm">
                  {invoice.createdAt.toLocaleDateString()} {invoice.createdAt.toLocaleTimeString()}
                </p>
              </div>
              {invoice.salesOrderId && (
                <div>
                  <span className="font-medium text-sm text-gray-700">Related Order:</span>
                  <p className="text-sm">{invoice.salesOrderId}</p>
                </div>
              )}
              <div>
                <span className="font-medium text-sm text-gray-700">Location:</span>
                <p className="text-sm">
                  {invoice.gpsCoordinates.latitude.toFixed(6)}, {invoice.gpsCoordinates.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">Invoice Items:</h4>
              <div className="space-y-2">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-600">
                        {item.color}, {item.size} - LKR {item.unitPrice} each
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Qty: {item.quantity}</p>
                      <p className="font-medium text-sm">LKR {item.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoice Total */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>LKR {invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-LKR {invoice.discountAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span>LKR {invoice.total.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Order Information (if available) */}
        {salesOrder && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Related Sales Order
                <Badge variant="outline">{salesOrder.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-sm text-gray-700">Order ID:</span>
                  <p className="text-sm">{salesOrder.id}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Status:</span>
                  <p className="text-sm capitalize">{salesOrder.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Created:</span>
                  <p className="text-sm">
                    {salesOrder.createdAt.toLocaleDateString()} {salesOrder.createdAt.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Created By:</span>
                  <p className="text-sm">{salesOrder.createdBy}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Approval Required:</span>
                  <p className="text-sm">{salesOrder.requiresApproval ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Order Location:</span>
                  <p className="text-sm">
                    {salesOrder.gpsCoordinates.latitude.toFixed(6)}, {salesOrder.gpsCoordinates.longitude.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Original Order Items */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-sm text-gray-700">Original Order Items:</h4>
                <div className="space-y-2">
                  {salesOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <div>
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-600">
                          {item.color}, {item.size} - LKR {item.unitPrice} each
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Qty: {item.quantity}</p>
                        <p className="font-medium text-sm">LKR {item.total.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Original Order Total */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Original Subtotal:</span>
                  <span>LKR {salesOrder.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({salesOrder.discountPercentage}%):</span>
                  <span>-LKR {salesOrder.discountAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Original Total:</span>
                  <span>LKR {salesOrder.total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InvoiceDetails;
