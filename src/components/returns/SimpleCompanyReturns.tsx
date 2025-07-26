import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RotateCcw, Eye, ArrowLeft, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CompanyReturn {
  id: string;
  agency_id: string;
  agency_name: string;
  total: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  created_at: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity_returned: number;
    unit_price: number;
    total: number;
    reason: string;
  }>;
}

interface Product {
  id: string;
  name: string;
  billing_price: number;
}

interface SimpleCompanyReturnsProps {
  user: User;
}

const SimpleCompanyReturns = ({ user }: SimpleCompanyReturnsProps) => {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<CompanyReturn | null>(null);
  const [returns, setReturns] = useState<CompanyReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [returnItems, setReturnItems] = useState([
    { product_id: '', product_name: '', quantity_returned: 1, unit_price: 0, reason: '' }
  ]);
  const [returnReason, setReturnReason] = useState('');

  useEffect(() => {
    fetchCompanyReturns();
    if (showCreateForm) {
      fetchProducts();
    }
  }, [showCreateForm]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, billing_price');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    }
  };

  const fetchCompanyReturns = async () => {
    try {
      setLoading(true);
      
      let returnsQuery = supabase
        .from('returns')
        .select(`
          id,
          agency_id,
          total,
          created_at,
          status,
          reason
        `)
        .order('created_at', { ascending: false });

      // If not superuser, filter by agency
      if (user.role !== 'superuser') {
        returnsQuery = returnsQuery.eq('agency_id', user.agencyId);
      }

      const { data: returnsData, error: returnsError } = await returnsQuery;

      if (returnsError) throw returnsError;

      const returnsWithDetails = await Promise.all(
        (returnsData || []).map(async (returnItem) => {
          // Get agency name
          const { data: agencyData, error: agencyError } = await supabase
            .from('agencies')
            .select('name')
            .eq('id', returnItem.agency_id)
            .single();

          if (agencyError) {
            console.error('Error fetching agency:', agencyError);
          }

          // Get return items
          const { data: itemsData, error: itemsError } = await supabase
            .from('return_items')
            .select(`
              id,
              product_id,
              product_name,
              quantity_returned,
              unit_price,
              total,
              reason
            `)
            .eq('return_id', returnItem.id);

          if (itemsError) {
            console.error('Error fetching return items:', itemsError);
          }

          return {
            id: returnItem.id,
            agency_id: returnItem.agency_id,
            agency_name: agencyData?.name || 'Unknown Agency',
            total: returnItem.total,
            reason: returnItem.reason,
            status: returnItem.status,
            created_at: returnItem.created_at,
            items: itemsData || []
          };
        })
      );

      setReturns(returnsWithDetails);
    } catch (error) {
      console.error('Error fetching company returns:', error);
      toast({
        title: "Error",
        description: "Failed to fetch company returns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updatedItems = [...returnItems];
      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        product_name: product.name,
        unit_price: product.billing_price,
      };
      setReturnItems(updatedItems);
    }
  };

  const updateReturnItem = (index: number, field: string, value: any) => {
    const updatedItems = [...returnItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setReturnItems(updatedItems);
  };

  const addReturnItem = () => {
    setReturnItems([...returnItems, { 
      product_id: '', 
      product_name: '', 
      quantity_returned: 1, 
      unit_price: 0, 
      reason: '' 
    }]);
  };

  const removeReturnItem = (index: number) => {
    if (returnItems.length > 1) {
      setReturnItems(returnItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => {
    return returnItems.reduce((total, item) => {
      return total + (item.quantity_returned * item.unit_price);
    }, 0);
  };

  const handleSubmitReturn = async () => {
    try {
      if (!returnReason.trim()) {
        toast({
          title: "Error",
          description: "Please provide a reason for the return",
          variant: "destructive",
        });
        return;
      }

      const validItems = returnItems.filter(item => 
        item.product_id && item.quantity_returned > 0 && item.unit_price > 0
      );

      if (validItems.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one valid return item",
          variant: "destructive",
        });
        return;
      }

      const total = calculateTotal();

      // Create return record
      const { data: returnData, error: returnError } = await supabase
        .from('returns')
        .insert({
          agency_id: user.agencyId,
          customer_id: null,
          customer_name: 'Company Return',
          reason: returnReason,
          total: total,
          subtotal: total,
          status: 'pending',
          latitude: null,
          longitude: null,
          created_by: user.id
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return items
      const returnItemsData = validItems.map(item => ({
        return_id: returnData.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_returned: item.quantity_returned,
        original_quantity: item.quantity_returned,
        unit_price: item.unit_price,
        total: item.quantity_returned * item.unit_price,
        reason: item.reason || returnReason,
        size: '',
        color: ''
      }));

      const { error: itemsError } = await supabase
        .from('return_items')
        .insert(returnItemsData);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Company return submitted successfully",
      });

      // Reset form and refresh data
      setShowCreateForm(false);
      setReturnItems([{ product_id: '', product_name: '', quantity_returned: 1, unit_price: 0, reason: '' }]);
      setReturnReason('');
      fetchCompanyReturns();

    } catch (error) {
      console.error('Error submitting return:', error);
      toast({
        title: "Error",
        description: "Failed to submit company return",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const },
      processed: { label: 'Processed', variant: 'outline' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setShowCreateForm(false)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <h2 className="text-2xl font-bold">Create Company Return</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Return Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="reason">Return Reason</Label>
              <Textarea
                id="reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Explain why you are returning these items..."
                className="mt-1"
              />
            </div>

            <div>
              <h3 className="font-semibold mb-4">Return Items</h3>
              {returnItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    {returnItems.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeReturnItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Product</Label>
                      <Select onValueChange={(value) => handleProductSelect(index, value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity_returned}
                        onChange={(e) => updateReturnItem(index, 'quantity_returned', parseInt(e.target.value) || 1)}
                        min="1"
                      />
                    </div>

                    <div>
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        value={item.unit_price}
                        readOnly
                        className="bg-gray-100"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Item Reason (Optional)</Label>
                    <Input
                      value={item.reason}
                      onChange={(e) => updateReturnItem(index, 'reason', e.target.value)}
                      placeholder="Specific reason for this item"
                    />
                  </div>

                  <div className="text-right">
                    <span className="font-medium">
                      Total: LKR {(item.quantity_returned * item.unit_price).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              <Button onClick={addReturnItem} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="text-right text-lg font-semibold">
                Grand Total: LKR {calculateTotal().toLocaleString()}
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleSubmitReturn}>
                Submit Return
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedReturn) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setSelectedReturn(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <h2 className="text-2xl font-bold">Company Return Details</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Return from {selectedReturn.agency_name}</span>
              {getStatusBadge(selectedReturn.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Return Date</p>
                <p className="font-medium">{new Date(selectedReturn.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="font-medium text-lg">LKR {selectedReturn.total.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600">Return Reason</p>
              <p className="font-medium">{selectedReturn.reason}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Return Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReturn.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity_returned}</TableCell>
                      <TableCell>LKR {item.unit_price.toLocaleString()}</TableCell>
                      <TableCell>LKR {item.total.toLocaleString()}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company Returns</h2>
          <p className="text-gray-600">
            {user.role === 'superuser' 
              ? 'View all returns submitted by agencies' 
              : 'Manage your agency returns'}
          </p>
        </div>
        {user.role !== 'superuser' && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Return
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {user.role === 'superuser' ? 'All Company Returns' : 'Your Returns'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading returns...</div>
          ) : returns.length === 0 ? (
            <div className="text-center py-8">
              <RotateCcw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No company returns found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {user.role === 'superuser' && <TableHead>Agency Name</TableHead>}
                  <TableHead>Total Return Value</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((returnItem) => (
                  <TableRow key={returnItem.id}>
                    {user.role === 'superuser' && (
                      <TableCell className="font-medium">{returnItem.agency_name}</TableCell>
                    )}
                    <TableCell>LKR {returnItem.total.toLocaleString()}</TableCell>
                    <TableCell>{new Date(returnItem.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedReturn(returnItem)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleCompanyReturns;
