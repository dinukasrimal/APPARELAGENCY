import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User as UserIcon,
  MapPin,
  Calendar,
  DollarSign,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SuperuserApprovalManagementProps {
  user: User;
}

const SuperuserApprovalManagement = ({ user }: SuperuserApprovalManagementProps) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrdersNeedingApproval();
  }, []);

  const fetchOrdersNeedingApproval = async () => {
    try {
      setLoading(true);
      
      // Fetch orders that require approval (superuser sees all agencies)
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          customer_id,
          customer_name,
          agency_id,
          subtotal,
          discount_percentage,
          discount_amount,
          total,
          status,
          requires_approval,
          approved_by,
          approved_at,
          created_at,
          created_by,
          latitude,
          longitude
        `)
        .eq('requires_approval', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders requiring approval',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ 
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Order Approved',
        description: `Order ${orderId} has been successfully approved`,
      });

      // Refresh the orders list
      fetchOrdersNeedingApproval();
    } catch (error) {
      console.error('Error approving order:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve order',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ 
          status: 'cancelled',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Order Rejected',
        description: `Order ${orderId} has been rejected`,
        variant: 'destructive',
      });

      // Refresh the orders list
      fetchOrdersNeedingApproval();
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject order',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  // Filter orders based on selected tab
  const pendingOrders = orders.filter(order => order.status === 'pending');
  const approvedOrders = orders.filter(order => order.status === 'approved');
  const rejectedOrders = orders.filter(order => order.status === 'cancelled');
  
  const filteredOrders = filter === 'pending' ? pendingOrders : 
                        filter === 'approved' ? approvedOrders :
                        filter === 'rejected' ? rejectedOrders :
                        orders;

  const getStatusBadge = (order: SalesOrder) => {
    if (order.status === 'pending') {
      return <Badge variant="secondary" className="flex items-center gap-1 text-orange-600 border-orange-200 bg-orange-50">
        <Clock className="h-3 w-3" />
        Pending Approval
      </Badge>;
    }
    if (order.status === 'approved') {
      return <Badge variant="default" className="flex items-center gap-1 text-green-600 border-green-200 bg-green-50">
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading orders requiring approval...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Order Approvals</h2>
          <p className="text-muted-foreground">
            Review and approve orders with discounts exceeding agency limits
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchOrdersNeedingApproval}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'pending', label: 'Pending', count: pendingOrders.length },
          { key: 'approved', label: 'Approved', count: approvedOrders.length },
          { key: 'rejected', label: 'Rejected', count: rejectedOrders.length },
          { key: 'all', label: 'All', count: orders.length }
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
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'pending' ? 'No pending approvals' : `No ${filter} orders`}
            </h3>
            <p className="text-gray-600">
              {filter === 'pending' 
                ? 'All orders are within approved discount limits.' 
                : `There are no ${filter} orders at this time.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <span className="font-mono text-sm">#{order.id}</span>
                      {getStatusBadge(order)}
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        {order.discountPercentage}% Discount
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        {order.customerName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        LKR {order.total?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleReject(order.id)}
                        disabled={processing === order.id}
                      >
                        {processing === order.id ? 'Rejecting...' : 'Reject'}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(order.id)}
                        disabled={processing === order.id}
                      >
                        {processing === order.id ? 'Approving...' : 'Approve'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">Subtotal:</span>
                    <p>LKR {order.subtotal?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Discount:</span>
                    <p className="text-red-600">-LKR {order.discountAmount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Total:</span>
                    <p className="font-bold">LKR {order.total?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Status:</span>
                    <p>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
                  </div>
                </div>

                {order.approvedAt && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      {order.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                      {new Date(order.approvedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Approval Required:</strong> Orders with discounts exceeding agency limits are automatically 
          marked as pending and require superuser approval before processing. Approved orders will be 
          processed immediately and inventory will be updated accordingly.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SuperuserApprovalManagement;