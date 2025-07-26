import { useState } from 'react';
import { User } from '@/types/auth';
import { SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Clock, User as UserIcon } from 'lucide-react';

interface ApprovalManagementProps {
  user: User;
  orders: SalesOrder[];
  onApprove: (orderId: string) => void;
  onReject: (orderId: string) => void;
}

const ApprovalManagement = ({ user, orders, onApprove, onReject }: ApprovalManagementProps) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // Only show orders that require approval or have been processed
  const pendingOrders = orders.filter(order => order.requiresApproval && order.status === 'pending');
  const processedOrders = orders.filter(order => order.requiresApproval && order.status !== 'pending');

  const filteredOrders = filter === 'pending' ? pendingOrders : 
                        filter === 'approved' ? processedOrders.filter(o => o.status === 'approved') :
                        filter === 'rejected' ? processedOrders.filter(o => o.status === 'cancelled') :
                        [...pendingOrders, ...processedOrders];

  const getStatusBadge = (order: SalesOrder) => {
    if (order.status === 'pending' && order.requiresApproval) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Pending Approval
      </Badge>;
    }
    if (order.status === 'approved') {
      return <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Approved
      </Badge>;
    }
    if (order.status === 'cancelled') {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Rejected
      </Badge>;
    }
    return null;
  };

  if (user.role !== 'superuser') {
    return (
      <div className="text-center py-12">
        <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only superusers can access approval management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approval Management</h2>
          <p className="text-gray-600">Review and approve orders with high discounts</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'pending', label: 'Pending', count: pendingOrders.length },
          { key: 'approved', label: 'Approved', count: processedOrders.filter(o => o.status === 'approved').length },
          { key: 'rejected', label: 'Rejected', count: processedOrders.filter(o => o.status === 'cancelled').length },
          { key: 'all', label: 'All', count: filteredOrders.length }
        ].map(({ key, label, count }) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key as any)}
            className="flex items-center gap-2"
          >
            {label} ({count})
          </Button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {order.id}
                    {getStatusBadge(order)}
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      {order.discountPercentage}% Discount
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Customer: {order.customerName} • Agency: {order.agencyId}
                  </p>
                  {order.approvedBy && order.approvedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Processed by: {order.approvedBy} on {order.approvedAt.toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">LKR {order.total.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">
                    Discount: LKR {order.discountAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Order Items Summary */}
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Items ({order.items.length}):</h4>
                  <div className="space-y-1">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.productName} ({item.color}, {item.size}) × {item.quantity}
                        </span>
                        <span>LKR {item.total.toLocaleString()}</span>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <div className="text-sm text-gray-500">
                        +{order.items.length - 2} more items
                      </div>
                    )}
                  </div>
                </div>

                {/* Discount Analysis */}
                <div className="bg-orange-50 p-3 rounded-lg">
                  <h4 className="font-medium text-sm text-orange-800 mb-1">Discount Analysis</h4>
                  <div className="text-sm text-orange-700">
                    <p>Standard discount limit: 20%</p>
                    <p>Requested discount: {order.discountPercentage}% (LKR {order.discountAmount.toLocaleString()})</p>
                    <p>Excess discount: {order.discountPercentage - 20}%</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-3 border-t">
                  <div className="text-xs text-gray-500">
                    Created: {order.createdAt.toLocaleDateString()} by {order.createdBy}
                  </div>
                  {order.status === 'pending' && order.requiresApproval && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => onReject(order.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => onApprove(order.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600">
            {filter === 'pending' 
              ? 'No orders are currently pending approval'
              : `No ${filter} orders found`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default ApprovalManagement;
