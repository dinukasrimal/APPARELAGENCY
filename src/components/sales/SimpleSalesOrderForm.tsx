
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SimpleSalesOrderFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  onSuccess: () => void;
  onCancel: () => void;
}

const SimpleSalesOrderForm = ({ user, customers, products, onSuccess, onCancel }: SimpleSalesOrderFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const addProductToOrder = (productId: string, color: string, size: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItemIndex = orderItems.findIndex(
      item => item.productId === productId && item.color === color && item.size === size
    );

    if (existingItemIndex >= 0) {
      const newItems = [...orderItems];
      newItems[existingItemIndex].quantity += 1;
      newItems[existingItemIndex].total = newItems[existingItemIndex].quantity * newItems[existingItemIndex].unitPrice;
      setOrderItems(newItems);
    } else {
      const newItem: OrderItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        color,
        size,
        quantity: 1,
        unitPrice: product.sellingPrice || 0,
        total: product.sellingPrice || 0
      };
      setOrderItems([...orderItems, newItem]);
    }
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(item => item.id !== itemId));
      return;
    }
    
    setOrderItems(orderItems.map(item => 
      item.id === itemId 
        ? { ...item, quantity, total: item.unitPrice * quantity }
        : item
    ));
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  const handleSubmit = async () => {
    if (!selectedCustomerId || orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select a customer and add at least one item",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('Starting order submission...');

      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      if (!selectedCustomer) {
        throw new Error('Selected customer not found');
      }

      // Create the sales order with properly typed status
      const orderData = {
        customer_id: selectedCustomerId,
        customer_name: selectedCustomer.name,
        agency_id: user.agencyId,
        subtotal: subtotal,
        discount_percentage: 0,
        discount_amount: 0,
        total: total,
        latitude: 28.6139,
        longitude: 77.2090,
        created_by: user.id,
        status: 'pending' as const,
        requires_approval: false
      };

      console.log('Inserting order:', orderData);

      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      console.log('Order created:', order);

      // Create order items
      const itemsData = orderItems.map(item => ({
        sales_order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      console.log('Inserting items:', itemsData);

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(itemsData);

      if (itemsError) {
        console.error('Items creation error:', itemsError);
        // Clean up the order if items failed
        await supabase.from('sales_orders').delete().eq('id', order.id);
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }

      console.log('Order and items created successfully');

      toast({
        title: "Success",
        description: `Order ${order.id} created successfully`,
      });

      onSuccess();

    } catch (error) {
      console.error('Order submission failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Create Sales Order</h2>
          <p className="text-gray-600">Simple order creation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products.map((product) => (
                  <div key={product.id} className="border rounded-lg p-4">
                    <h4 className="font-medium">{product.name}</h4>
                    <p className="text-sm text-gray-600">RS {product.sellingPrice?.toLocaleString()}</p>
                    
                    <div className="mt-3 grid gap-2">
                      {product.colors?.map((color) => (
                        product.sizes?.map((size) => (
                          <Button
                            key={`${color}-${size}`}
                            size="sm"
                            variant="outline"
                            onClick={() => addProductToOrder(product.id, color, size)}
                            className="justify-start"
                          >
                            Add {color} - {size}
                          </Button>
                        ))
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Order Items ({orderItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h4 className="font-medium">{item.productName}</h4>
                        <p className="text-sm text-gray-600">{item.color}, {item.size}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-20 text-center"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <div className="text-right min-w-24">
                          <p className="font-medium">RS {item.total.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Items:</span>
                  <span>{orderItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>RS {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>RS {total.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedCustomerId || orderItems.length === 0 || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Creating Order...' : 'Create Order'}
                </Button>
                <Button variant="outline" onClick={onCancel} className="w-full" disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimpleSalesOrderForm;
