import { useState } from 'react';
import { User } from '@/types/auth';
import { Invoice, Return } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Plus, RotateCcw } from 'lucide-react';
import CreateReturnForm from './CreateReturnForm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin } from 'lucide-react';

interface ReturnsManagementProps {
  user: User;
  returns: Return[];
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
  onRefresh?: () => void;
}

const ReturnsManagement = ({ user, returns, invoices, customers, products, onRefresh }: ReturnsManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const { toast } = useToast();

  // Filter returns based on user role and filters
  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = returnItem.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         returnItem.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (returnItem.invoiceId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || returnItem.status === statusFilter;
    const matchesAgency = user.role === 'superuser' || returnItem.agencyId === user.agencyId;
    
    return matchesSearch && matchesStatus && matchesAgency;
  });

  const getStatusBadge = (status: Return['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      processed: { label: 'Processed', variant: 'default' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleCreateReturn = async (returnData: any) => {
    try {
      // Create return header
      const { data: createdReturn, error: returnError } = await supabase
        .from('returns')
        .insert({
          invoice_id: returnData.invoiceId,
          customer_id: returnData.customerId,
          customer_name: returnData.customerName,
          agency_id: returnData.agencyId,
          subtotal: returnData.subtotal,
          total: returnData.total,
          reason: returnData.reason,
          // Auto-approve customer returns (no manual approval step required)
          status: returnData.status ?? 'approved',
          latitude: returnData.gpsCoordinates?.latitude ?? null,
          longitude: returnData.gpsCoordinates?.longitude ?? null,
          created_by: user.id
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return items
      const itemsPayload = (returnData.items || []).map((item: any) => ({
        return_id: createdReturn.id,
        invoice_item_id: item.invoiceItemId || null,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity_returned: item.quantityReturned,
        original_quantity: item.originalQuantity,
        unit_price: item.unitPrice,
        total: item.total,
        reason: item.reason || returnData.reason || ''
      }));

      if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabase
          .from('return_items')
          .insert(itemsPayload);
        if (itemsError) throw itemsError;
      }

      // Prepare product description map to get canonical names (with codes) from products.description
      const productDescriptions: Record<string, string> = {};
      const productIds = Array.from(
        new Set(itemsPayload.map((item) => item.product_id).filter(Boolean))
      );

      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, description')
          .in('id', productIds);
        if (productsError) {
          console.error('Failed to fetch product descriptions', productsError);
        } else {
          productsData?.forEach((p) => {
            if (p.id) {
              productDescriptions[p.id] = p.description || '';
            }
          });
        }
      }

      // Add inventory transactions to put stock back (non-blocking)
      try {
        const userName = user.name || 'Unknown User';
        const nowIso = new Date().toISOString();
        const transactions = itemsPayload.map(item => {
          const baseName =
            (item.product_id && productDescriptions[item.product_id]) ||
            item.product_name ||
            'Unknown Product';
          const productCodeMatch = baseName.match(/^\s*\[([^\]]+)\]/);
          const fallbackCode = item.product_id ? item.product_id.slice(0, 8) : null;
          const productCode = productCodeMatch ? productCodeMatch[1] : fallbackCode;
          const productNameWithCode = productCode
            ? `[${productCode}] ${baseName.replace(/^\s*\[[^\]]+\]\s*/, '')}`
            : baseName;
          return {
            agency_id: returnData.agencyId,
            product_name: productNameWithCode,
            product_code: productCode,
            // Inventory table requires non-null color/size; default to "Default" if missing
            color: item.color || 'Default',
            size: item.size || 'Default',
            transaction_type: 'customer_return',
            quantity: item.quantity_returned, // positive to increase stock
            reference_name: `Return ${createdReturn.id}`,
            user_id: user.id,
            user_name: userName,
            notes: item.reason || returnData.reason || '',
            matched_product_id: item.product_id || null,
            approval_status: 'approved',
            transaction_date: nowIso,
            external_source: 'return',
            transaction_id: createdReturn.id
          };
        });

        const { error: invError } = await supabase
          .from('external_inventory_management')
          .insert(transactions);

        if (invError) {
          console.error('Failed to create inventory transactions for return:', invError);
          toast({
            title: 'Inventory update failed',
            description: invError.message || 'Could not add returned items back to inventory.',
            variant: 'destructive'
          });
        }
      } catch (invErr) {
        console.error('Inventory update (return) failed:', invErr);
        toast({
          title: 'Inventory update failed',
          description: 'Could not add returned items back to inventory.',
          variant: 'destructive'
        });
      }

      toast({
        title: 'Return created',
        description: `Return ${createdReturn.id} saved successfully.`,
      });

      setShowCreateForm(false);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to create return:', error);
      toast({
        title: 'Error',
        description: 'Could not save the return. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (showCreateForm) {
    return (
      <CreateReturnForm
        user={user}
        customers={customers}
        products={products}
        onSubmit={handleCreateReturn}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (selectedReturn) {
    const customerInvoices = invoices.filter(
      (inv) =>
        inv.customerId === selectedReturn.customerId &&
        (user.role === 'superuser' || inv.agencyId === user.agencyId) &&
        ((inv.outstandingAmount ?? inv.total) > 0)
    );

    const handleLinkInvoice = async (invoiceId: string) => {
      try {
        const { error } = await supabase
          .from('returns')
          .update({ invoice_id: invoiceId })
          .eq('id', selectedReturn.id);

        if (error) throw error;

        toast({
          title: 'Invoice linked',
          description: `Return ${selectedReturn.id} is now linked to invoice ${invoiceId}`
        });

        const updated = { ...selectedReturn, invoiceId };
        setSelectedReturn(updated);
        if (onRefresh) {
          onRefresh();
        }
      } catch (err) {
        console.error('Failed to link invoice to return:', err);
        toast({
          title: 'Error',
          description: 'Could not link invoice. Please try again.',
          variant: 'destructive'
        });
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedReturn(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Returns
          </Button>
          <h3 className="text-lg font-semibold">Return {selectedReturn.id}</h3>
          {getStatusBadge(selectedReturn.status)}
        </div>

        <Card>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-gray-700">Invoice</p>
                <p className="text-gray-800">{selectedReturn.invoiceId || 'Not linked yet'}</p>
                {customerInvoices.length > 0 && (
                  <Select
                    onValueChange={handleLinkInvoice}
                    value={selectedReturn.invoiceId || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link an invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoiceNumber || inv.id} • LKR {inv.total.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-gray-600">Customer: {selectedReturn.customerName}</p>
              </div>
              <div className="text-right md:text-left">
                <p className="font-medium text-gray-700">Total Returned</p>
                <p className="text-lg font-bold text-red-600">LKR {selectedReturn.total.toLocaleString()}</p>
                <p className="text-gray-600">Subtotal: LKR {selectedReturn.subtotal.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-sm text-gray-700">
              <p className="font-medium">Reason</p>
              <p className="text-gray-800">{selectedReturn.reason}</p>
            </div>
            <div className="text-xs text-gray-600 flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              GPS: {selectedReturn.gpsCoordinates.latitude.toFixed(6)}, {selectedReturn.gpsCoordinates.longitude.toFixed(6)}
            </div>

            <div className="space-y-2">
              <p className="font-medium text-gray-700">Items</p>
              <div className="space-y-2">
                {selectedReturn.items.map(item => (
                  <div key={item.id} className="border rounded p-2 text-sm flex justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-gray-600">{item.color}, {item.size}</p>
                      <p className="text-gray-600">Returned: {item.quantityReturned} / {item.originalQuantity}</p>
                      {item.reason && <p className="text-gray-600">Reason: {item.reason}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">LKR {item.total.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">@ {item.unitPrice}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 h-full flex flex-col">
      {/* Header - More compact */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900">Returns Management</h3>
          <p className="text-sm md:text-base text-gray-600">
            {user.role === 'superuser' ? 'All returns across agencies' : 'Your agency returns'}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="bg-red-600 hover:bg-red-700 text-sm" size="sm">
          <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
          Process Return
        </Button>
      </div>

      {/* Filters - More compact */}
      <div className="flex gap-2 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 md:h-4 md:w-4" />
          <Input
            placeholder="Search by return ID, invoice ID, or customer name..."
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
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Returns List - Grid layout for tablets */}
      {filteredReturns.length === 0 ? (
        <div className="text-center py-6 md:py-12 flex-1 flex flex-col items-center justify-center">
          <RotateCcw className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-2 md:mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">No returns found</h3>
          <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-4">
            {searchTerm || (statusFilter !== 'all') 
              ? 'Try adjusting your search or filter criteria'
              : 'No returns have been processed yet'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button onClick={() => setShowCreateForm(true)} className="bg-red-600 hover:bg-red-700 text-sm" size="sm">
              <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Process Return
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 flex-1 overflow-y-auto">
          {filteredReturns.map((returnItem) => (
            <Card key={returnItem.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                      <h3 className="font-semibold text-base md:text-lg truncate">{returnItem.id}</h3>
                      {getStatusBadge(returnItem.status)}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{returnItem.customerName}</p>
                    <p className="text-xs md:text-sm text-gray-500">
                      Invoice: {returnItem.invoiceId || 'Not linked yet'} • {returnItem.items.length} items
                    </p>
                    <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2">{returnItem.reason}</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="text-right">
                      <p className="text-lg md:text-xl font-bold text-red-600">LKR {returnItem.total.toLocaleString()}</p>
                      <p className="text-xs md:text-sm text-gray-500">
                        {returnItem.createdAt.toLocaleDateString()}
                      </p>
                      {returnItem.processedAt && (
                        <p className="text-xs text-green-600">
                          Processed {returnItem.processedAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-1 md:gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedReturn(returnItem)}
                        className="text-xs h-7 md:h-8"
                      >
                        <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1" />
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

export default ReturnsManagement;
