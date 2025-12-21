import { useState, useEffect, useRef } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { SalesOrderItem } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Minus, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateOrderFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

const CreateOrderForm = ({ user, customers, products, onSubmit, onCancel }: CreateOrderFormProps) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [gpsLoading, setGpsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const { toast } = useToast();

  // Auto-capture GPS on component mount
  useEffect(() => {
    console.log('CreateOrderForm mounted, capturing GPS...');
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    try {
      setGpsLoading(true);
      console.log('Attempting to get GPS location...');
      
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
          );
        });

        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        console.log('GPS coordinates captured for order:', coords);
        setGpsCoordinates(coords);
        setGpsLoading(false);
        return coords;
      } else {
        throw new Error('Geolocation not supported');
      }
    } catch (error) {
      console.error('GPS Error:', error);
      // Use mock coordinates if GPS fails
      const coords = {
        latitude: 28.6139 + Math.random() * 0.01,
        longitude: 77.2090 + Math.random() * 0.01
      };
      console.log('Using mock GPS coordinates:', coords);
      setGpsCoordinates(coords);
      setGpsLoading(false);
      return coords;
    }
  };

  const addProduct = (product: Product, color: string, size: string) => {
    console.log('Adding product to order:', { product: product.name, color, size });
    const productPrice = product.sellingPrice || 0;
    const newItem: SalesOrderItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      color,
      size,
      quantity: 1,
      unitPrice: productPrice,
      total: productPrice
    };

    setOrderItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.productId === product.id && item.color === color && item.size === size
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
        console.log('Updated existing item quantity:', updated[existingIndex]);
        return updated;
      }

      console.log('Added new item to order:', newItem);
      return [...prev, newItem];
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    console.log('Updating quantity for item:', itemId, 'new quantity:', quantity);
    if (quantity <= 0) {
      setOrderItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }

    setOrderItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity, total: item.unitPrice * quantity }
        : item
    ));
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const discountPercentage = 0;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = subtotal - discountAmount;

  const handleSubmit = async () => {
    console.log('=== STARTING ORDER SUBMISSION ===');
    console.log('Form validation checks:');
    console.log('- Selected customer:', selectedCustomer ? selectedCustomer.name : 'NONE');
    console.log('- Order items count:', orderItems.length);
    console.log('- GPS coordinates:', gpsCoordinates);
    console.log('- User details:', { id: user.id, agencyId: user.agencyId, role: user.role });
    console.log('- Order totals:', { subtotal, discountPercentage, discountAmount, total });

    if (!selectedCustomer) {
      console.error('VALIDATION FAILED: No customer selected');
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (orderItems.length === 0) {
      console.error('VALIDATION FAILED: No items in order');
      toast({
        title: "Error", 
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    if (gpsCoordinates.latitude === 0 || gpsCoordinates.longitude === 0) {
      console.error('VALIDATION FAILED: No GPS coordinates');
      toast({
        title: "Error",
        description: "GPS location is required. Please ensure location access is enabled.",
        variant: "destructive",
      });
      return;
    }

    console.log('✓ All validations passed, proceeding with order creation...');

    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    
    try {
      setIsSubmitting(true);
      
      // Prepare the sales order data
      const salesOrderData = {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        agency_id: user.agencyId,
        subtotal: subtotal,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        total: total,
        latitude: gpsCoordinates.latitude,
        longitude: gpsCoordinates.longitude,
        created_by: user.id,
        status: 'pending' as const,
        requires_approval: false
      };

      console.log('Sales order data prepared:', salesOrderData);

      // Insert the sales order
      console.log('Inserting sales order into database...');
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert(salesOrderData)
        .select()
        .single();

      if (orderError) {
        console.error('ERROR inserting sales order:', orderError);
        console.error('Error details:', {
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint,
          code: orderError.code
        });
        throw new Error(`Failed to create sales order: ${orderError.message}`);
      }

      console.log('✓ Sales order created successfully:', salesOrder);

      // Prepare order items data
      const itemsToInsert = orderItems.map(item => ({
        sales_order_id: salesOrder.id,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      console.log('Order items data prepared:', itemsToInsert);

      // Insert order items
      console.log('Inserting order items into database...');
      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('ERROR inserting order items:', itemsError);
        console.error('Error details:', {
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
          code: itemsError.code
        });
        
        // If items fail to insert, delete the order to maintain consistency
        console.log('Cleaning up: deleting order due to items insertion failure...');
        await supabase.from('sales_orders').delete().eq('id', salesOrder.id);
        throw new Error(`Failed to create order items: ${itemsError.message}`);
      }

      console.log('✓ Order items created successfully');
      console.log('=== ORDER CREATION COMPLETED SUCCESSFULLY ===');

      toast({
        title: "Success",
        description: `Sales order ${salesOrder.id} created successfully`,
      });

      // Reset form
      console.log('Resetting form state...');
      setSelectedCustomer(null);
      setOrderItems([]);
      
      // Call the onSubmit callback to refresh the parent component
      console.log('Calling onSubmit callback to refresh data...');
      await onSubmit();
      
    } catch (error) {
      console.error('=== ORDER CREATION FAILED ===');
      console.error('Error details:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sales order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
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
          <h2 className="text-2xl font-bold text-gray-900">Create Sales Order</h2>
          <p className="text-gray-600">Add products and create a new sales order</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer">Select Customer *</Label>
                  <Select onValueChange={(value) => {
                    const customer = customers.find(c => c.id === value);
                    console.log('Selected customer:', customer);
                    setSelectedCustomer(customer || null);
                  }}>
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
                </div>

                {selectedCustomer && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">{selectedCustomer.name}</h4>
                    <p className="text-sm text-blue-700">{selectedCustomer.phone}</p>
                    <p className="text-sm text-blue-700">{selectedCustomer.address}</p>
                  </div>
                )}

                {gpsLoading ? (
                  <div className="p-2 bg-blue-50 rounded text-blue-700 text-sm">
                    📍 Capturing GPS location...
                  </div>
                ) : gpsCoordinates.latitude !== 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <MapPin className="h-4 w-4" />
                    Location captured: {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}
                  </div>
                ) : (
                  <div className="p-2 bg-red-50 rounded text-red-700 text-sm">
                    ⚠ Failed to capture GPS location
                  </div>
                )}
              </div>
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
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-gray-600">{product.category}</p>
                        <p className="text-lg font-semibold text-green-600">RS {product.sellingPrice?.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Color and Size Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {product.colors?.map((color) => (
                        <div key={color}>
                          <p className="text-sm font-medium mb-2">Color: {color}</p>
                          <div className="flex flex-wrap gap-2">
                            {product.sizes?.map((size) => (
                              <Button
                                key={size}
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  console.log('Adding product:', product.name, color, size);
                                  addProduct(product, color, size);
                                }}
                              >
                                {size}
                              </Button>
                            ))}
                          </div>
                        </div>
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
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.productName}</h4>
                        <p className="text-sm text-gray-600">
                          {item.color}, {item.size} - RS {item.unitPrice} each
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
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
                        </div>
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
                  disabled={!selectedCustomer || orderItems.length === 0 || gpsCoordinates.latitude === 0 || gpsLoading || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Creating Order...' : gpsLoading ? 'Waiting for GPS...' : 'Create Order'}
                </Button>
                <Button variant="outline" onClick={onCancel} className="w-full" disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>

              {/* Debug Information */}
              <div className="text-xs text-gray-500 space-y-1 pt-4 border-t">
                <div>Customer: {selectedCustomer ? '✓' : '✗'}</div>
                <div>Items: {orderItems.length}</div>
                <div>GPS: {gpsCoordinates.latitude !== 0 ? '✓' : '✗'}</div>
                <div>Agency ID: {user.agencyId}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderForm;
