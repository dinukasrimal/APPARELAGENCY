import { Return, Invoice } from '@/types/sales';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RotateCcw, FileText, CheckCircle, XCircle } from 'lucide-react';

interface ReturnDetailsProps {
  returnItem: Return;
  invoice?: Invoice | null;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Return>) => void;
  user: User;
}

const ReturnDetails = ({ returnItem, invoice, onBack, onUpdate, user }: ReturnDetailsProps) => {
  const handleApprove = () => {
    onUpdate(returnItem.id, {
      status: 'approved',
      processedAt: new Date(),
      processedBy: user.id
    });
  };

  const handleReject = () => {
    onUpdate(returnItem.id, {
      status: 'rejected',
      processedAt: new Date(),
      processedBy: user.id
    });
  };

  const handleProcess = () => {
    onUpdate(returnItem.id, {
      status: 'processed',
      processedAt: new Date(),
      processedBy: user.id
    });
  };

  const getStatusBadge = (status: Return['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      processed: { label: 'Processed', variant: 'default' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const }
    };
    
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Return Details</h2>
            <p className="text-gray-600">{returnItem.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {returnItem.status === 'pending' && user.role === 'superuser' && (
            <>
              <Button 
                onClick={handleReject}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button 
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          {returnItem.status === 'approved' && (
            <Button 
              onClick={handleProcess}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Processed
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Return Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Return Information
              {getStatusBadge(returnItem.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-sm text-gray-700">Return ID:</span>
                <p className="text-sm">{returnItem.id}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Invoice ID:</span>
                <p className="text-sm">{returnItem.invoiceId}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Customer:</span>
                <p className="text-sm">{returnItem.customerName}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Agency:</span>
                <p className="text-sm">{returnItem.agencyId}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created:</span>
                <p className="text-sm">
                  {returnItem.createdAt.toLocaleDateString()} {returnItem.createdAt.toLocaleTimeString()}
                </p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created By:</span>
                <p className="text-sm">{returnItem.createdBy}</p>
              </div>
              {returnItem.processedAt && (
                <>
                  <div>
                    <span className="font-medium text-sm text-gray-700">Processed:</span>
                    <p className="text-sm">
                      {returnItem.processedAt.toLocaleDateString()} {returnItem.processedAt.toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-700">Processed By:</span>
                    <p className="text-sm">{returnItem.processedBy}</p>
                  </div>
                </>
              )}
              <div>
                <span className="font-medium text-sm text-gray-700">Location:</span>
                <p className="text-sm">
                  {returnItem.gpsCoordinates.latitude.toFixed(6)}, {returnItem.gpsCoordinates.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Return Reason */}
            <div className="space-y-2 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">Return Reason:</h4>
              <p className="text-sm bg-gray-50 p-2 rounded">{returnItem.reason}</p>
            </div>

            {/* Return Items */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">Returned Items:</h4>
              <div className="space-y-2">
                {returnItem.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-600">
                        {item.color}, {item.size} - LKR {item.unitPrice} each
                      </p>
                      <p className="text-xs text-gray-600">
                        Returned: {item.quantityReturned} / {item.originalQuantity}
                      </p>
                      {item.reason && (
                        <p className="text-xs text-red-600 italic">{item.reason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm text-red-600">-LKR {item.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Total */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between font-semibold text-lg text-red-600">
                <span>Total Return Amount:</span>
                <span>-LKR {returnItem.total.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Original Invoice Information */}
        {invoice && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Original Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-sm text-gray-700">Invoice ID:</span>
                  <p className="text-sm">{invoice.id}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Invoice Date:</span>
                  <p className="text-sm">
                    {invoice.createdAt.toLocaleDateString()} {invoice.createdAt.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Original Total:</span>
                  <p className="text-sm">LKR {invoice.total.toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-700">Invoice Location:</span>
                  <p className="text-sm">
                    {invoice.gpsCoordinates.latitude.toFixed(6)}, {invoice.gpsCoordinates.longitude.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Original Invoice Items */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-sm text-gray-700">Original Invoice Items:</h4>
                <div className="space-y-2">
                  {invoice.items.map((item) => {
                    const returnedItem = returnItem.items.find(ri => ri.invoiceItemId === item.id);
                    return (
                      <div key={item.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <div>
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-600">
                            {item.color}, {item.size} - LKR {item.unitPrice} each
                          </p>
                          <p className="text-xs text-gray-600">
                            Original Qty: {item.quantity}
                            {returnedItem && (
                              <span className="text-red-600 ml-2">
                                (Returned: {returnedItem.quantityReturned})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">LKR {item.total.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Original Invoice Total */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Original Subtotal:</span>
                  <span>LKR {invoice.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount:</span>
                  <span>-LKR {invoice.discountAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Original Total:</span>
                  <span>LKR {invoice.total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ReturnDetails;
