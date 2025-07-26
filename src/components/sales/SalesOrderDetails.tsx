import { useState } from 'react';
import { User } from '@/types/auth';
import { SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, FileText } from 'lucide-react';
import CreateInvoiceForm from './CreateInvoiceForm';

interface SalesOrderDetailsProps {
  user: User;
  order: SalesOrder;
  onBack: () => void;
  onEdit?: () => void;
  onCreateInvoice?: () => void;
}

const SalesOrderDetails = ({ user, order, onBack, onEdit }: SalesOrderDetailsProps) => {
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);

  const getStatusBadge = (status: SalesOrder['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      partially_invoiced: { label: 'Partially Invoiced', variant: 'outline' as const },
      invoiced: { label: 'Invoiced', variant: 'default' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
      closed: { label: 'Closed', variant: 'secondary' as const }
    };
    
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRemainingAmount = () => {
    return order.total - order.totalInvoiced;
  };

  const canCreateInvoice = order.status === 'approved' || order.status === 'partially_invoiced';

  if (showCreateInvoice) {
    return (
      <CreateInvoiceForm
        user={user}
        salesOrder={order}
        onSubmit={() => {
          setShowCreateInvoice(false);
          onBack(); // Go back to refresh the orders list
        }}
        onCancel={() => setShowCreateInvoice(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">Sales Order Details</h2>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-3">
                {order.orderNumber}
                {getStatusBadge(order.status)}
                {order.requiresApproval && order.status === 'pending' && (
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Approval Required
                  </Badge>
                )}
                {order.status === 'invoiced' && order.totalInvoiced >= order.total && (
                  <Badge variant="default" className="bg-green-600">
                    Fully Invoiced
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Customer: {order.customerName}
                {user.role === 'superuser' && (
                  <span className="ml-2">• Agency: {order.agencyId}</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">LKR {order.total.toLocaleString()}</p>
              <p className="text-sm text-gray-600">
                {order.discountPercentage}% discount applied
              </p>
              {order.totalInvoiced > 0 && (
                <div className="text-sm mt-1">
                  <p className="text-blue-600">Invoiced: LKR {order.totalInvoiced.toLocaleString()}</p>
                  {getRemainingAmount() > 0 && (
                    <p className="text-orange-600">Remaining: LKR {getRemainingAmount().toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Order Items */}
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-3">Items:</h4>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">
                        Color: {item.color} | Size: {item.size} | Quantity: {item.quantity}
                      </p>
                      <p className="text-sm text-gray-600">Unit Price: LKR {item.unitPrice.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">LKR {item.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-3">Order Summary:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>LKR {order.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Discount ({order.discountPercentage}%):</span>
                  <span>-LKR {order.discountAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>LKR {order.total.toLocaleString()}</span>
                </div>
                {order.totalInvoiced > 0 && (
                  <>
                    <div className="flex justify-between text-blue-600">
                      <span>Total Invoiced:</span>
                      <span>LKR {order.totalInvoiced.toLocaleString()}</span>
                    </div>
                    {getRemainingAmount() > 0 && (
                      <div className="flex justify-between text-orange-600 font-semibold">
                        <span>Remaining to Invoice:</span>
                        <span>LKR {getRemainingAmount().toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* GPS Coordinates */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Location:</h4>
              <p className="text-sm text-gray-600">
                Latitude: {order.gpsCoordinates.latitude.toFixed(6)}, Longitude: {order.gpsCoordinates.longitude.toFixed(6)}
              </p>
            </div>

            {/* Creation Info */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">
                Created: {order.createdAt.toLocaleDateString()} {order.createdAt.toLocaleTimeString()}
              </p>
              <p className="text-sm text-gray-500">Created by: {order.createdBy}</p>
              {order.approvedBy && (
                <p className="text-sm text-gray-500">
                  Approved by: {order.approvedBy} on {order.approvedAt?.toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              {order.status === 'pending' && onEdit && !order.requiresApproval && (
                <Button variant="outline" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Order
                </Button>
              )}
              {canCreateInvoice && getRemainingAmount() > 0 && (
                <Button 
                  className="bg-green-600 hover:bg-green-700" 
                  onClick={() => setShowCreateInvoice(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Convert to Invoice
                </Button>
              )}
              {!canCreateInvoice && order.status === 'pending' && (
                <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                  Order must be approved before it can be converted to an invoice
                </div>
              )}
              {getRemainingAmount() <= 0 && order.totalInvoiced > 0 && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  This order has been fully invoiced
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-sm text-gray-700">Order Number:</span>
                <p className="text-sm font-mono">{order.orderNumber}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Customer:</span>
                <p className="text-sm">{order.customerName}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Status:</span>
                <div className="flex items-center gap-2">
                  {getStatusBadge(order.status)}
                </div>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created:</span>
                <p className="text-sm">
                  {order.createdAt.toLocaleDateString()} {order.createdAt.toLocaleTimeString()}
                </p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created By:</span>
                <p className="text-sm">{order.createdBy}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Approval Required:</span>
                <p className="text-sm">{order.requiresApproval ? 'Yes' : 'No'}</p>
              </div>
              {order.approvedBy && (
                <div>
                  <span className="font-medium text-sm text-gray-700">Approved By:</span>
                  <p className="text-sm">{order.approvedBy}</p>
                </div>
              )}
              {order.approvedAt && (
                <div>
                  <span className="font-medium text-sm text-gray-700">Approved At:</span>
                  <p className="text-sm">
                    {order.approvedAt.toLocaleDateString()} {order.approvedAt.toLocaleTimeString()}
                  </p>
                </div>
              )}
              <div>
                <span className="font-medium text-sm text-gray-700">Order Location:</span>
                <p className="text-sm">
                  {order.gpsCoordinates.latitude.toFixed(6)}, {order.gpsCoordinates.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesOrderDetails;
