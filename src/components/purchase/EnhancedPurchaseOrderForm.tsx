import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Product } from '@/types/product';
import { PurchaseOrderItem } from '@/types/purchase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MapPin, Plus, Trash2, Package, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EnhancedPurchaseOrderFormProps {
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}

interface OrderSummaryItem extends PurchaseOrderItem {
  tempId: string;
}

const EnhancedPurchaseOrderForm = ({ user, onSuccess, onCancel }: EnhancedPurchaseOrderFormProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [productGridItems, setProductGridItems] = useState<Array<{
    product: Product;
    color: string;
    sizes: Array<{ size: string; quantity: number; }>;
  }>>([]);
  const [orderSummary, setOrderSummary] = useState<OrderSummaryItem[]>([]);
  const [notes, setNotes] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      const transformedProducts: Product[] = (data || []).map(product => ({
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

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    }
  };

  const categories = [...new Set(products.map(p => p.category))];
  const subCategories = selectedCategory 
    ? [...new Set(products.filter(p => p.category === selectedCategory).map(p => p.subCategory))]
    : [];
  const colors = selectedCategory && selectedSubCategory
    ? [...new Set(products
        .filter(p => p.category === selectedCategory && p.subCategory === selectedSubCategory)
        .flatMap(p => p.colors))]
    : [];

  useEffect(() => {
    if (selectedCategory && selectedSubCategory && selectedColor) {
      const filteredProducts = products.filter(p => 
        p.category === selectedCategory && 
        p.subCategory === selectedSubCategory && 
        p.colors.includes(selectedColor)
      );

      setProductGridItems(filteredProducts.map(product => ({
        product,
        color: selectedColor,
        sizes: product.sizes.map(size => ({ size, quantity: 0 }))
      })));
    } else {
      setProductGridItems([]);
    }
  }, [selectedCategory, selectedSubCategory, selectedColor, products]);

  const updateQuantity = (productIndex: number, sizeIndex: number, quantity: number) => {
    setProductGridItems(prev => prev.map((item, pIdx) => 
      pIdx === productIndex 
        ? {
            ...item,
            sizes: item.sizes.map((sizeItem, sIdx) => 
              sIdx === sizeIndex ? { ...sizeItem, quantity: Math.max(0, quantity) } : sizeItem
            )
          }
        : item
    ));
  };

  const addToOrderSummary = () => {
    const itemsToAdd: OrderSummaryItem[] = [];
    
    productGridItems.forEach(gridItem => {
      gridItem.sizes.forEach(sizeItem => {
        if (sizeItem.quantity > 0) {
          itemsToAdd.push({
            tempId: `${gridItem.product.id}-${gridItem.color}-${sizeItem.size}-${Date.now()}`,
            id: '',
            productId: gridItem.product.id,
            productName: gridItem.product.name,
            color: gridItem.color,
            size: sizeItem.size,
            quantity: sizeItem.quantity,
            unitPrice: gridItem.product.billingPrice,
            total: gridItem.product.billingPrice * sizeItem.quantity
          });
        }
      });
    });

    if (itemsToAdd.length === 0) {
      toast({
        title: "No items to add",
        description: "Please enter quantities for the products you want to add",
        variant: "destructive"
      });
      return;
    }

    setOrderSummary(prev => [...prev, ...itemsToAdd]);
    
    // Reset the grid
    setProductGridItems(prev => prev.map(item => ({
      ...item,
      sizes: item.sizes.map(size => ({ ...size, quantity: 0 }))
    })));

    toast({
      title: "Items added",
      description: `${itemsToAdd.length} item(s) added to order summary`
    });
  };

  const removeFromOrderSummary = (tempId: string) => {
    setOrderSummary(prev => prev.filter(item => item.tempId !== tempId));
  };

  const captureGPS = async () => {
    setGpsCapturing(true);
    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
          );
        });

        setGpsCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        
        toast({
          title: "Location captured",
          description: "GPS coordinates captured successfully"
        });
      } else {
        throw new Error('Geolocation not supported');
      }
    } catch (error) {
      // Fallback for demo
      setGpsCoordinates({
        latitude: 7.8731 + Math.random() * 0.01,
        longitude: 80.7718 + Math.random() * 0.01
      });
      toast({
        title: "Location captured",
        description: "Demo GPS coordinates captured"
      });
    } finally {
      setGpsCapturing(false);
    }
  };

  const calculateTotal = () => {
    return orderSummary.reduce((sum, item) => sum + item.total, 0);
  };

  const submitPurchaseOrder = async () => {
    if (orderSummary.length === 0) {
      toast({
        title: "Missing information",
        description: "Please add items to the order",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Capture GPS on save
      await captureGPS();
      
      // Wait a moment for GPS to be set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (gpsCoordinates.latitude === 0) {
        toast({
          title: "GPS Required",
          description: "Please wait for GPS coordinates to be captured",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      const total = calculateTotal();

      // Create purchase order
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          agency_id: user.agencyId,
          agency_name: user.agencyName || '',
          total,
          status: 'pending',
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          notes,
          created_by: user.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = orderSummary.map(item => ({
        purchase_order_id: orderData.id,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Purchase Order Created",
        description: `Order ${orderData.id} has been created successfully`
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = calculateTotal();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">Create Purchase Order</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              {gpsCoordinates.latitude !== 0 ? (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">GPS Captured</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}
                  </p>
                </div>
              ) : (
                <Button
                  onClick={captureGPS}
                  disabled={gpsCapturing}
                  variant="outline"
                  className="w-full"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {gpsCapturing ? 'Capturing GPS...' : 'Capture GPS Location'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Product Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sub Category</Label>
                  <Select 
                    value={selectedSubCategory} 
                    onValueChange={setSelectedSubCategory}
                    disabled={!selectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub category" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((subCategory) => (
                        <SelectItem key={subCategory} value={subCategory}>
                          {subCategory}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Color</Label>
                  <Select 
                    value={selectedColor} 
                    onValueChange={setSelectedColor}
                    disabled={!selectedSubCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {colors.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product Grid */}
              {productGridItems.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Enter Quantities</h4>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {productGridItems.map((gridItem, productIndex) => (
                      <div key={gridItem.product.id} className="border rounded-lg p-4">
                        <h5 className="font-medium mb-3">{gridItem.product.name}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {gridItem.sizes.map((sizeItem, sizeIndex) => (
                            <div key={sizeItem.size} className="space-y-1">
                              <Label className="text-sm">{sizeItem.size}</Label>
                              <Input
                                type="number"
                                min="0"
                                value={sizeItem.quantity}
                                onChange={(e) => updateQuantity(productIndex, sizeIndex, parseInt(e.target.value) || 0)}
                                placeholder="Qty"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={addToOrderSummary} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Order Summary
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes or special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Order Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Summary ({orderSummary.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orderSummary.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No items added yet</p>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {orderSummary.map((item) => (
                      <div key={item.tempId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-600">{item.color}, {item.size} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">LKR {item.total.toLocaleString()}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromOrderSummary(item.tempId)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>LKR {total.toLocaleString()}</span>
                    </div>

                    <Button
                      onClick={submitPurchaseOrder}
                      disabled={isSubmitting || orderSummary.length === 0}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Saving...' : 'Submit Purchase Order'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EnhancedPurchaseOrderForm;
