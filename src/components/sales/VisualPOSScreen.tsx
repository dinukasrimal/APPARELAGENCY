import { useState, useRef, useEffect } from 'react';
import { User } from '@/types/auth';
import { SalesOrder, SalesOrderItem } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, AlertTriangle, ShoppingCart, Plus, Minus, Trash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VisualPOSScreenProps {
  user: User;
  onSubmit: (order: Omit<SalesOrder, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const VisualPOSScreen = ({ user, onSubmit, onCancel }: VisualPOSScreenProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user.agencyId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([fetchCustomers(), fetchProducts()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      let query = supabase.from('customers').select('*');
      
      if (user.role !== 'superuser' && user.agencyId) {
        query = query.eq('agency_id', user.agencyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedCustomers = data.map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        agencyId: customer.agency_id,
        gpsCoordinates: { 
          latitude: customer.latitude || 0, 
          longitude: customer.longitude || 0 
        },
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by
      }));

      setCustomers(formattedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
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
    }
  };

  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : products;

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = subtotal - discountAmount;
  const requiresApproval = discountPercentage > 20;

  const handleProductClick = (product: Product) => {
    if (product.colors.length === 0 || product.sizes.length === 0) {
      toast({
        title: "Product Configuration Error",
        description: "This product doesn't have colors or sizes configured",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedProduct(product);
    setSelectedColor(product.colors[0]);
    setSelectedSize(product.sizes[0]);
    setQuantity(1);
    setShowQuantityDialog(true);
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedColor || !selectedSize) return;

    const existingItemIndex = orderItems.findIndex(
      item => item.productId === selectedProduct.id && item.color === selectedColor && item.size === selectedSize
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].unitPrice * updatedItems[existingItemIndex].quantity;
      setOrderItems(updatedItems);
    } else {
      const newItem: SalesOrderItem = {
        id: Date.now().toString(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        color: selectedColor,
        size: selectedSize,
        quantity,
        unitPrice: selectedProduct.sellingPrice,
        total: selectedProduct.sellingPrice * quantity
      };
      setOrderItems([...orderItems, newItem]);
    }

    setQuantity(1);
    setSelectedColor(selectedProduct.colors[0]);
    setSelectedSize(selectedProduct.sizes[0]);
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    
    setOrderItems(orderItems.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, total: item.unitPrice * newQuantity }
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
    if (!selectedCustomer || orderItems.length === 0 || gpsCoordinates.latitude === 0) {
      toast({
        title: "Missing Information",
        description: "Please select customer, add items, and capture GPS location",
        variant: "destructive"
      });
      return;
    }
    // Generate a simple order number (timestamp-based)
    const orderNumber = `SO-${Date.now()}`;
    const orderData: Omit<SalesOrder, 'id' | 'createdAt' | 'createdBy'> = {
      orderNumber,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      agencyId: user.agencyId || 'agency-1',
      items: orderItems,
      subtotal,
      discountPercentage,
      discountAmount,
      total,
      totalInvoiced: 0,
      status: 'pending',
      requiresApproval,
      gpsCoordinates
    };
    onSubmit(orderData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products and customers...</p>
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
            <h2 className="text-xl font-bold">Visual POS System</h2>
            <p className="text-sm text-gray-600">Click product images to add to cart</p>
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
          {/* Left Panel - Categories and Products */}
          <div className="lg:col-span-3 space-y-4">
            {/* Customer Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Select Customer</CardTitle>
              </CardHeader>
              <CardContent>
                {customers.length === 0 ? (
                  <p className="text-gray-500">No customers found. Please add customers first.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customers.map((customer) => (
                      <Button
                        key={customer.id}
                        variant={selectedCustomer?.id === customer.id ? "default" : "outline"}
                        className="h-auto p-3 text-left justify-start"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.phone}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-gray-500">No product categories found. Please add products first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategory === null ? "default" : "outline"}
                      onClick={() => setSelectedCategory(null)}
                    >
                      All Products
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        onClick={() => setSelectedCategory(category)}
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
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Products {selectedCategory && `- ${selectedCategory}`}
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                      <Card 
                        key={product.id} 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => handleProductClick(product)}
                      >
                        <CardContent className="p-3">
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
                          <h3 className="font-medium text-sm mb-1">{product.name}</h3>
                          <p className="text-xs text-gray-600 mb-2">{product.subCategory}</p>
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-600">LKR {product.sellingPrice}</span>
                            <Badge variant="outline" className="text-xs">
                              {product.colors.length} colors
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Cart and Summary */}
          <div className="space-y-4">
            {/* Cart */}
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Cart ({orderItems.length})
                  </span>
                  {orderItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrderItems([])}
                    >
                      Clear
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click products to add to cart</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{item.productName}</h4>
                          <p className="text-xs text-gray-600">
                            {item.color}, {item.size}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-xs">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-600"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right min-w-16">
                          <div className="font-medium text-xs">LKR {item.total}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Order Summary */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label>Discount Type</Label>
                    <div className="flex gap-4 mt-1">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="discountType"
                          value="percentage"
                          checked={discountType === 'percentage'}
                          onChange={() => setDiscountType('percentage')}
                        />
                        Percentage (%)
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="discountType"
                          value="amount"
                          checked={discountType === 'amount'}
                          onChange={() => setDiscountType('amount')}
                        />
                        Fixed Amount (LKR)
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label>{discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount (LKR)'}</Label>
                    <Input
                      type="number"
                      min="0"
                      max={discountType === 'percentage' ? '100' : undefined}
                      value={discountType === 'percentage' ? discountPercentage : discountAmountInput}
                      onChange={(e) => {
                        if (discountType === 'percentage') setDiscountPercentage(Number(e.target.value));
                        else setDiscountAmountInput(Number(e.target.value));
                      }}
                      placeholder={discountType === 'percentage' ? '0' : '0'}
                    />
                    {discountType === 'percentage' && requiresApproval && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-orange-50 rounded text-orange-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Requires approval</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>LKR {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-green-600 text-sm">
                      <span>Discount ({discountPercentage}%):</span>
                      <span>-LKR {discountAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>LKR {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Button
                      onClick={handleSubmit}
                      disabled={!selectedCustomer || orderItems.length === 0 || gpsCoordinates.latitude === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Create Order
                    </Button>
                    <Button variant="outline" onClick={onCancel} className="w-full">
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quantity Selection Dialog */}
        <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add to Cart</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  {selectedProduct.image ? (
                    <img 
                      src={selectedProduct.image} 
                      alt={selectedProduct.name}
                      className="w-20 h-20 object-cover rounded"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-400">No Image</span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{selectedProduct.name}</h3>
                    <p className="text-sm text-gray-600">{selectedProduct.description}</p>
                    <p className="font-bold text-blue-600">LKR {selectedProduct.sellingPrice}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedProduct.colors.map((color) => (
                        <Button
                          key={color}
                          size="sm"
                          variant={selectedColor === color ? "default" : "outline"}
                          onClick={() => setSelectedColor(color)}
                        >
                          {color}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Size</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedProduct.sizes.map((size) => (
                        <Button
                          key={size}
                          size="sm"
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
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Unit Price:</span>
                      <span className="text-blue-600 font-medium">LKR {selectedProduct.sellingPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-medium">Quantity:</span>
                      <span className="text-blue-600 font-medium">{quantity}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t pt-2 border-blue-200">
                      <span className="font-bold">Total Value:</span>
                      <span className="text-blue-700 font-bold text-lg">LKR {(selectedProduct.sellingPrice * quantity).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowQuantityDialog(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={addToCart} className="flex-1">
                    Add to Cart
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VisualPOSScreen;
