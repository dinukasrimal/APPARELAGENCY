import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { SalesOrder, Invoice, Return } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Eye, Plus, ShoppingCart, FileText, RotateCcw, ChevronDown, Edit, X } from 'lucide-react';
import EnhancedSalesOrderForm from './EnhancedSalesOrderForm';
import DirectInvoiceForm from './DirectInvoiceForm';
import SalesOrderDetails from './SalesOrderDetails';
import InvoiceManagement from './InvoiceManagement';
import ReturnsManagement from './ReturnsManagement';
import CreateInvoiceForm from './CreateInvoiceForm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SalesOrdersProps {
  user: User;
}

const SalesOrders = ({ user }: SalesOrdersProps) => {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDirectInvoiceForm, setShowDirectInvoiceForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [convertingToInvoiceOrder, setConvertingToInvoiceOrder] = useState<SalesOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [showAllOrders, setShowAllOrders] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching sales data for user:', user.id);

      // Fetch sales orders with role-based filtering
      let ordersQuery = supabase.from('sales_orders').select('*');
      
      if (user.role === 'agent') {
        ordersQuery = ordersQuery.eq('created_by', user.id);
      } else if (user.role === 'agency') {
        ordersQuery = ordersQuery.eq('agency_id', user.agencyId);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery.order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch sales order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Transform orders with items
      const transformedOrders: SalesOrder[] = (ordersData || []).map(order => {
        const orderItems = (itemsData || []).filter(item => item.sales_order_id === order.id);
        
        return {
          id: order.id,
          orderNumber: order.id,
          customerId: order.customer_id,
          customerName: order.customer_name,
          agencyId: order.agency_id,
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
          subtotal: Number(order.subtotal),
          discountPercentage: Number(order.discount_percentage),
          discountAmount: Number(order.discount_amount),
          total: Number(order.total),
          totalInvoiced: Number(order.total_invoiced || 0),
          status: order.status,
          requiresApproval: order.requires_approval,
          approvedBy: order.approved_by,
          approvedAt: order.approved_at ? new Date(order.approved_at) : undefined,
          gpsCoordinates: {
            latitude: order.latitude || 0,
            longitude: order.longitude || 0
          },
          createdAt: new Date(order.created_at),
          createdBy: order.created_by
        };
      });

      setOrders(transformedOrders);

      // Fetch invoices with role-based filtering
      let invoicesQuery = supabase.from('invoices').select('*');
      
      if (user.role === 'agent') {
        invoicesQuery = invoicesQuery.eq('created_by', user.id);
      } else if (user.role === 'agency') {
        invoicesQuery = invoicesQuery.eq('agency_id', user.agencyId);
      }

      const { data: invoicesData, error: invoicesError } = await invoicesQuery.order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Fetch invoice items
      const { data: invoiceItemsData, error: invoiceItemsError } = await supabase
        .from('invoice_items')
        .select('*');

      if (invoiceItemsError) throw invoiceItemsError;

      // Transform invoices with items
      const transformedInvoices: Invoice[] = (invoicesData || []).map(invoice => {
        const invoiceItems = (invoiceItemsData || []).filter(item => item.invoice_id === invoice.id);
        
        return {
          id: invoice.id,
          invoiceNumber: invoice.id,
          salesOrderId: invoice.sales_order_id,
          customerId: invoice.customer_id,
          customerName: invoice.customer_name,
          agencyId: invoice.agency_id,
          items: invoiceItems.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            total: Number(item.total)
          })),
          subtotal: Number(invoice.subtotal),
          discountAmount: Number(invoice.discount_amount),
          total: Number(invoice.total),
          gpsCoordinates: {
            latitude: invoice.latitude || 0,
            longitude: invoice.longitude || 0
          },
          signature: invoice.signature,
          createdAt: new Date(invoice.created_at),
          createdBy: invoice.created_by
        };
      });

      setInvoices(transformedInvoices);

      // Fetch customers with role-based filtering
      let customersQuery = supabase.from('customers').select('*');
      
      if (user.role === 'agent') {
        customersQuery = customersQuery.eq('created_by', user.id);
      } else if (user.role === 'agency') {
        customersQuery = customersQuery.eq('agency_id', user.agencyId);
      }

      const { data: customersData, error: customersError } = await customersQuery.order('name');

      if (customersError) throw customersError;

      // Fetch products (available to all roles)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;

      const transformedCustomers: Customer[] = (customersData || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        agencyId: customer.agency_id,
        gpsCoordinates: {
          latitude: customer.latitude || 0,
          longitude: customer.longitude || 0
        },
        storefrontPhoto: customer.storefront_photo,
        signature: customer.signature,
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by
      }));

      const transformedProducts: Product[] = (productsData || []).map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        subCategory: product.sub_category || '',
        colors: product.colors || [],
        sizes: product.sizes || [],
        sellingPrice: Number(product.selling_price),
        billingPrice: Number(product.billing_price),
        image: product.image || null,
        description: product.description
      }));

      setCustomers(transformedCustomers);
      setProducts(transformedProducts);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const isActive = order.status !== 'invoiced' && order.status !== 'closed';
    // Only show active orders unless showAllOrders is true
    return matchesSearch && matchesStatus && (showAllOrders || isActive);
  });

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

  const getRemainingAmount = (order: SalesOrder) => {
    return order.total - order.totalInvoiced;
  };

  const canEdit = (order: SalesOrder) => {
    // Allow editing if order is pending OR if it's approved/partially_invoiced but not fully invoiced
    return (order.status === 'pending' && !order.requiresApproval) || 
           ((order.status === 'approved' || order.status === 'partially_invoiced') && getRemainingAmount(order) > 0);
  };

  const canConvertToInvoice = (order: SalesOrder) => {
    return (order.status === 'approved' || order.status === 'partially_invoiced') && getRemainingAmount(order) > 0;
  };

  const canClose = (order: SalesOrder) => {
    return order.status !== 'closed' && order.status !== 'cancelled' && order.status !== 'invoiced';
  };

  const handleCloseOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ status: 'closed' })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sales order has been closed",
      });

      await fetchData();
    } catch (error) {
      console.error('Error closing order:', error);
      toast({
        title: "Error",
        description: "Failed to close order",
        variant: "destructive",
      });
    }
  };

  const handleOrderSuccess = async () => {
    await fetchData();
    setShowCreateForm(false);
    setShowDirectInvoiceForm(false);
    setEditingOrder(null);
    setConvertingToInvoiceOrder(null);
  };

  if (showCreateForm) {
    if (customers.length === 0 || products.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
              Back
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Sales Order</h2>
              <p className="text-gray-600">Cannot create orders - missing data</p>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Missing Required Data</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  {customers.length === 0 && <p>• No customers found. Please add customers first.</p>}
                  {products.length === 0 && <p>• No products found. Please add products first.</p>}
                </div>
                <Button 
                  onClick={() => setShowCreateForm(false)} 
                  className="mt-4"
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <EnhancedSalesOrderForm
        user={user}
        customers={customers}
        products={products}
        onSuccess={handleOrderSuccess}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (showDirectInvoiceForm) {
    if (customers.length === 0 || products.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setShowDirectInvoiceForm(false)}>
              Back
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Direct Invoice</h2>
              <p className="text-gray-600">Cannot create invoices - missing data</p>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Missing Required Data</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  {customers.length === 0 && <p>• No customers found. Please add customers first.</p>}
                  {products.length === 0 && <p>• No products found. Please add products first.</p>}
                </div>
                <Button 
                  onClick={() => setShowDirectInvoiceForm(false)} 
                  className="mt-4"
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <DirectInvoiceForm
        user={user}
        customers={customers}
        products={products}
        onSuccess={handleOrderSuccess}
        onCancel={() => setShowDirectInvoiceForm(false)}
      />
    );
  }

  if (editingOrder) {
    return (
      <EnhancedSalesOrderForm
        user={user}
        customers={customers}
        products={products}
        editingOrder={editingOrder}
        onSuccess={handleOrderSuccess}
        onCancel={() => setEditingOrder(null)}
      />
    );
  }

  if (convertingToInvoiceOrder) {
    return (
      <CreateInvoiceForm
        user={user}
        salesOrder={convertingToInvoiceOrder}
        onSubmit={handleOrderSuccess}
        onCancel={() => setConvertingToInvoiceOrder(null)}
      />
    );
  }

  if (selectedOrder) {
    return (
      <SalesOrderDetails
        order={selectedOrder}
        user={user}
        onBack={() => setSelectedOrder(null)}
        onEdit={canEdit(selectedOrder) ? () => setEditingOrder(selectedOrder) : undefined}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Modern Loading Header */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1">
                  <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Sales Management</h2>
                  <p className="text-lg text-slate-600 font-medium">Loading sales data...</p>
                </div>
                <div className="w-32 h-14 bg-slate-200 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
          
          {/* Modern Loading Content */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-white/20">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Loading Sales Data</h3>
            <p className="text-slate-600 text-lg">Please wait while we fetch your sales information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Modern Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex-1">
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Sales Management</h2>
                <p className="text-lg text-slate-600 font-medium mb-3">
                  {user.role === 'superuser' ? 'All sales data across agencies' : 
                   user.role === 'agency' ? 'Your agency sales data' : 'Your sales orders'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge className="bg-blue-100 text-blue-700 font-medium px-3 py-1 rounded-full">
                    {customers.length} Customers
                  </Badge>
                  <Badge className="bg-green-100 text-green-700 font-medium px-3 py-1 rounded-full">
                    {products.length} Products
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-700 font-medium px-3 py-1 rounded-full">
                    {filteredOrders.length} Orders
                  </Badge>
                </div>
              </div>
              <div className="w-full lg:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      disabled={customers.length === 0 || products.length === 0}
                      className="group relative w-full lg:w-auto h-14 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <Plus className="h-5 w-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                      Create New
                      <ChevronDown className="h-5 w-5 ml-3 group-hover:rotate-180 transition-transform duration-300" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl border border-slate-200 shadow-xl bg-white/95 backdrop-blur-sm">
                    <DropdownMenuItem 
                      onClick={() => setShowCreateForm(true)}
                      className="flex items-center gap-3 p-4 rounded-lg hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                    >
                      <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">Sales Order</p>
                        <p className="text-xs text-slate-500">Create a new sales order</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDirectInvoiceForm(true)}
                      className="flex items-center gap-3 p-4 rounded-lg hover:bg-green-50 transition-colors duration-200 cursor-pointer"
                    >
                      <div className="bg-green-100 rounded-full w-8 h-8 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">Direct Invoice</p>
                        <p className="text-xs text-slate-500">Create invoice directly</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Setup Warning */}
        {(customers.length === 0 || products.length === 0) && (
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 shadow-lg rounded-2xl mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-orange-100 rounded-full w-12 h-12 flex items-center justify-center">
                  <div className="text-orange-600 text-xl">⚠️</div>
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-orange-800 mb-2">Setup Required</h4>
                  <p className="text-orange-700 font-medium">
                    {customers.length === 0 && products.length === 0 
                      ? 'Please add customers and products before creating sales orders.'
                      : customers.length === 0 
                      ? 'Please add customers before creating sales orders.'
                      : 'Please add products before creating sales orders.'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modern Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 h-14 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg mb-6">
            <TabsTrigger 
              value="orders" 
              className="flex items-center gap-3 text-base font-medium rounded-xl transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <ShoppingCart className="h-5 w-5" />
              Orders ({filteredOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="invoices" 
              className="flex items-center gap-3 text-base font-medium rounded-xl transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <FileText className="h-5 w-5" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger 
              value="returns" 
              className="flex items-center gap-3 text-base font-medium rounded-xl transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <RotateCcw className="h-5 w-5" />
              Returns ({returns.length})
            </TabsTrigger>
          </TabsList>

        <TabsContent value="orders" className="space-y-2 md:space-y-3 flex-1 flex flex-col">
          {/* Filters - More compact */}
          <div className="flex gap-2 md:gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 md:h-4 md:w-4" />
              <Input
                placeholder="Search by order ID or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 md:pl-10 h-9 md:h-10 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 md:w-48 h-9 md:h-10 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="partially_invoiced">Partially Invoiced</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 pl-2">
              <Switch id="show-all-orders" checked={showAllOrders} onCheckedChange={setShowAllOrders} />
              <Label htmlFor="show-all-orders">Show All Orders</Label>
            </div>
          </div>

          {/* Orders List - Grid layout for tablets */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-6 md:py-12 flex-1 flex flex-col items-center justify-center">
              <ShoppingCart className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-2 md:mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">No sales orders found</h3>
              <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-4">
                {searchTerm || (statusFilter !== 'all') 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first sales order to get started'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setShowCreateForm(true)} variant="outline" size="sm">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Create Order
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 flex-1 overflow-y-auto">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 md:gap-2 mb-1">
                          <h3 className="font-semibold text-base md:text-lg truncate">{order.orderNumber}</h3>
                          {getStatusBadge(order.status)}
                          {order.requiresApproval && order.status === 'pending' && (
                            <Badge variant="destructive" className="text-xs">Requires Approval</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{order.customerName}</p>
                        <div className="text-xs md:text-sm text-gray-500">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''} • {order.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                        <div className="text-right">
                          <p className="text-lg md:text-xl font-bold">LKR {order.total.toLocaleString()}</p>
                          {order.discountPercentage > 0 && (
                            <p className="text-xs md:text-sm text-gray-500 line-through">
                              LKR {order.subtotal.toLocaleString()}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-1 md:gap-2 flex-wrap">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                            className="text-xs h-7 md:h-8"
                          >
                            <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                            View
                          </Button>
                          
                          {canEdit(order) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setEditingOrder(order)}
                              className="text-xs h-7 md:h-8"
                            >
                              <Edit className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          
                          {canConvertToInvoice(order) && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-xs h-7 md:h-8"
                              onClick={() => setConvertingToInvoiceOrder(order)}
                            >
                              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                              Invoice
                            </Button>
                          )}
                          
                          {canClose(order) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50 text-xs h-7 md:h-8"
                              onClick={() => handleCloseOrder(order.id)}
                            >
                              <X className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                              Close
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="flex-1">
          <InvoiceManagement 
            user={user} 
            invoices={invoices} 
            orders={orders}
          />
        </TabsContent>

        <TabsContent value="returns" className="flex-1">
          <ReturnsManagement 
            user={user} 
            returns={returns} 
            invoices={invoices}
            customers={customers}
          />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default SalesOrders;
