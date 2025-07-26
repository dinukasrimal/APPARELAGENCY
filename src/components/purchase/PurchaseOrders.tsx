import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { PurchaseOrder } from '@/types/purchase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Plus, Package } from 'lucide-react';
import EnhancedPurchaseOrderForm from './EnhancedPurchaseOrderForm';
import PrintablePurchaseOrder from './PrintablePurchaseOrder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PurchaseOrdersProps {
  user: User;
}

const PurchaseOrders = ({ user }: PurchaseOrdersProps) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      // Fetch purchase orders with role-based filtering
      let ordersQuery = supabase.from('purchase_orders').select('*');
      
      if (user.role === 'agent') {
        ordersQuery = ordersQuery.eq('created_by', user.id);
      } else if (user.role === 'agency') {
        ordersQuery = ordersQuery.eq('agency_id', user.agencyId);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery.order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch purchase order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Transform orders with items
      const transformedOrders: PurchaseOrder[] = (ordersData || []).map(order => {
        const orderItems = (itemsData || []).filter(item => item.purchase_order_id === order.id);
        
        return {
          id: order.id,
          agencyId: order.agency_id,
          agencyName: order.agency_name,
          items: orderItems.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            total: Number(item.total)
          })),
          total: Number(order.total),
          status: order.status,
          gpsCoordinates: {
            latitude: order.latitude || 0,
            longitude: order.longitude || 0
          },
          notes: order.notes,
          createdAt: new Date(order.created_at),
          createdBy: order.created_by
        };
      });

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast({
        title: "Error",
        description: "Failed to load purchase orders",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.agencyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      shipped: { label: 'Shipped', variant: 'outline' as const },
      delivered: { label: 'Delivered', variant: 'default' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const }
    };
    
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleOrderSuccess = async () => {
    await fetchOrders();
    setShowCreateForm(false);
  };

  if (showCreateForm) {
    return (
      <EnhancedPurchaseOrderForm
        user={user}
        onSuccess={handleOrderSuccess}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (selectedOrder) {
    return (
      <PrintablePurchaseOrder
        purchaseOrder={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
            <p className="text-gray-600">Loading purchase orders...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
          <p className="text-gray-600">
            {user.role === 'superuser' ? 'All purchase orders across agencies' : 
             user.role === 'agency' ? 'Your agency purchase orders' : 'Your purchase orders'}
          </p>
          <div className="text-sm text-gray-500 mt-1">
            Total Orders: {filteredOrders.length}
          </div>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Order
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by order ID or agency name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || (statusFilter !== 'all') 
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first purchase order to get started'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button onClick={() => setShowCreateForm(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{order.id}</h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-sm text-gray-600">{order.agencyName}</p>
                      <p className="text-sm text-gray-500">{order.items.length} items</p>
                      {order.notes && (
                        <p className="text-sm text-gray-500">Notes: {order.notes}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold">LKR {order.total.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">
                        {order.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
