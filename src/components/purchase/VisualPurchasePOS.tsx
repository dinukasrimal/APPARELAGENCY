import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Minus, Trash, MapPin, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VisualPurchasePOSProps {
  user: User;
  onSubmit: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const VisualPurchasePOS = ({ user, onSubmit, onCancel }: VisualPurchasePOSProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [notes, setNotes] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedProducts = data.map(product => ({
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

      setProducts(formattedProducts);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(formattedProducts.map(p => p.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter products by category
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : products;

  const total = orderItems.reduce((sum, item) => sum + item.total, 0);

  const addProductToOrder = () => {
    if (!selectedProduct || !selectedColor || !selectedSize || quantity <= 0) {
      toast({
        title: "Missing Information",
        description: "Please select product, color, size and valid quantity",
        variant: "destructive"
      });
      return;
    }

    const existingItemIndex = orderItems.findIndex(
      item => item.productId === selectedProduct.id && item.color === selectedColor && item.size === selectedSize
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].unitPrice * updatedItems[existingItemIndex].quantity;
      setOrderItems(updatedItems);
    } else {
      const newItem: PurchaseOrderItem = {
        id: Date.now().toString(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        color: selectedColor,
        size: selectedSize,
        quantity,
        unitPrice: selectedProduct.billingPrice,
        total: selectedProduct.billingPrice * quantity
      };
      setOrderItems([...orderItems, newItem]);
    }

    // Reset selections
    setSelectedProduct(null);
    setSelectedColor('');
    setSelectedSize('');
    setQuantity(1);
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    
    setOrderItems(orderItems.map(item => 
      item.id === itemId 
        ? { ...item, quantity, total: item.unitPrice * quantity }
        : item
    ));
  };

  const removeItem = (itemId: string) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId));
  };

  const captureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          toast({
            title: "GPS Captured",
            description: "Location captured successfully",
          });
        },
        () => {
          setGpsCoordinates({
            latitude: 28.6139 + Math.random() * 0.01,
            longitude: 77.2090 + Math.random() * 0.01
          });
          toast({
            title: "GPS Captured",
            description: "Demo location captured",
          });
        }
      );
    }
  };

  const handleSubmit = () => {
    if (orderItems.length === 0 || gpsCoordinates.latitude === 0) {
      toast({
        title: "Missing Information",
        description: "Please add items and capture GPS location",
        variant: "destructive"
      });
      return;
    }
    
    const orderData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'createdBy'> = {
      agencyId: user.agencyId || 'agency-1',
      agencyName: user.agencyName || 'Default Agency',
      items: orderItems,
      total,
      status: 'pending',
      gpsCoordinates,
      notes: notes.trim() || undefined
    };

    onSubmit(orderData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Visual Purchase Order</h2>
            <p className="text-sm text-gray-600">Visual interface for ordering inventory</p>
          </div>
          <Button
            onClick={captureGPS}
            variant={gpsCoordinates.latitude !== 0 ? "default" : "outline"}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            {gpsCoordinates.latitude !== 0 ? 'GPS Captured' : 'Capture GPS'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Product Selection */}
          <div className="lg:col-span-3 space-y-4">
            {/* Category Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-gray-500">No product categories found. Please add products first.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Button
                      variant={selectedCategory === '' ? "default" : "outline"}
                      onClick={() => setSelectedCategory('')}
                      className="h-12"
                    >
                      All Categories
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        onClick={() => setSelectedCategory(category)}
                        className="h-12"
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products Grid */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Select Products
                  {selectedCategory && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      ({selectedCategory})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredProducts.length === 0 ? (
                  <p className="text-gray-500">
                    {selectedCategory 
                      ? `No products found in ${selectedCategory} category.`
                      : 'No products found. Please add products to your catalog first.'
                    }
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredProducts.map((product) => (
                      <Card 
                        key={product.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedProduct?.id === product.id ? 'ring-2 ring-purple-500' : ''
                        }`}
                        onClick={() => {
                          setSelectedProduct(product);
                          setSelectedColor(product.colors[0] || '');
                          setSelectedSize(product.sizes[0] || '');
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                            {product.image ? (
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <span className="text-sm">No Image</span>
                              </div>
                            )}
                          </div>
                          <h3 className="font-medium">{product.name}</h3>
                          <p className="text-sm text-gray-600">{product.subCategory}</p>
                          <p className="text-lg font-semibold text-purple-600">LKR {product.billingPrice}</p>
                          <p className="text-xs text-gray-500">{product.colors.length} colors, {product.sizes.length} sizes</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Color, Size and Quantity Selection */}
            {selectedProduct && selectedProduct.colors.length > 0 && selectedProduct.sizes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Configure: {selectedProduct.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Colors</Label>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {selectedProduct.colors.map((color) => (
                        <Button
                          key={color}
                          variant={selectedColor === color ? "default" : "outline"}
                          onClick={() => setSelectedColor(color)}
                        >
                          {color}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Sizes</Label>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {selectedProduct.sizes.map((size) => (
                        <Button
                          key={size}
                          variant={selectedSize === size ? "default" : "outline"}
                          onClick={() => setSelectedSize(size)}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Quantity</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={addProductToOrder}
                    disabled={!selectedColor || !selectedSize || quantity <= 0}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    Add to Order (Qty: {quantity})
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedProduct && (selectedProduct.colors.length === 0 || selectedProduct.sizes.length === 0) && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-orange-600">
                    This product doesn't have colors or sizes configured. Please update the product master.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order ({orderItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order Items */}
                <div className="max-h-60 overflow-auto space-y-2">
                  {orderItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select products to add to order</p>
                    </div>
                  ) : (
                    orderItems.map((item) => (
                      <div key={item.id} className="p-2 bg-gray-50 rounded">
                        <div className="text-sm font-medium">{item.productName}</div>
                        <div className="text-xs text-gray-600">{item.color}, {item.size}</div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="px-2 text-sm">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium">LKR {item.total}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                              className="h-6 w-6 p-0 text-red-600"
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Optional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-16"
                  />
                </div>

                {/* Total */}
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex justify-between font-bold text-lg border-t pt-1">
                    <span>Total:</span>
                    <span>LKR {total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={orderItems.length === 0 || gpsCoordinates.latitude === 0}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    Create Purchase Order
                  </Button>
                  <Button variant="outline" onClick={onCancel} className="w-full">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualPurchasePOS;
