import { useState, useRef, useEffect } from 'react';
import { User } from '@/types/auth';
import { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { ArrowLeft, Search, Plus, Minus, Trash, MapPin, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface POSPurchaseFormProps {
  user: User;
  onSubmit: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const POSPurchaseForm = ({ user, onSubmit, onCancel }: POSPurchaseFormProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showProductSelection, setShowProductSelection] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        image: product.image,
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

  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.subCategory.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const total = orderItems.reduce((sum, item) => sum + item.total, 0);

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedColor(product.colors[0] || '');
    setSelectedSize(product.sizes[0] || '');
    setQuantity(1);
    setShowProductSelection(false);
    setSearchTerm('');
  };

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
        unitPrice: selectedProduct.billingPrice, // Use billing price for purchase orders
        total: selectedProduct.billingPrice * quantity
      };
      setOrderItems([...orderItems, newItem]);
    }
    
    // Reset selections
    setSelectedProduct(null);
    setSelectedColor('');
    setSelectedSize('');
    setQuantity(1);
    searchInputRef.current?.focus();
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
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Purchase Order</h2>
            <p className="text-sm text-gray-600">Order inventory from the company</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Product Search & Entry */}
          <div className="lg:col-span-2 space-y-4">
            {/* Company Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Ordering To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-medium text-blue-900">Main Company Warehouse</div>
                  <div className="text-sm text-blue-700">Agency: {user.agencyName || 'Default Agency'}</div>
                  <div className="text-sm text-blue-700">Agent: {user.name}</div>
                </div>
              </CardContent>
            </Card>

            {/* Product Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Select Products
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category Filter */}
                <div>
                  <Label>Product Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Search */}
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowProductSelection(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowProductSelection(searchTerm.length > 0)}
                    className="text-lg p-3"
                    autoFocus
                  />
                  
                  {showProductSelection && filteredProducts.length > 0 && (
                    <Card className="absolute top-full left-0 right-0 z-10 mt-1 max-h-80 overflow-auto">
                      <CardContent className="p-2">
                        <div className="space-y-2">
                          {filteredProducts.map((product) => (
                            <div
                              key={product.id}
                              className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                              onClick={() => selectProduct(product)}
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-600">
                                {product.category} • {product.subCategory} • LKR {product.billingPrice}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {products.length === 0 && (
                  <p className="text-gray-500">No products found. Please add products to your catalog first.</p>
                )}

                {/* Product Configuration */}
                {selectedProduct && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-lg">{selectedProduct.name}</h3>
                      <p className="text-sm text-gray-600">
                        {selectedProduct.category} • LKR {selectedProduct.billingPrice}
                      </p>
                    </div>

                    {selectedProduct.colors.length > 0 && selectedProduct.sizes.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Color</Label>
                            <Select value={selectedColor} onValueChange={setSelectedColor}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select color" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedProduct.colors.map((color) => (
                                  <SelectItem key={color} value={color}>
                                    {color}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Size</Label>
                            <Select value={selectedSize} onValueChange={setSelectedSize}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedProduct.sizes.map((size) => (
                                  <SelectItem key={size} value={size}>
                                    {size}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                              placeholder="Qty"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={addProductToOrder}
                          disabled={!selectedColor || !selectedSize || quantity <= 0}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          Add to Order (Qty: {quantity})
                        </Button>
                      </>
                    ) : (
                      <div className="text-orange-600">
                        This product doesn't have colors or sizes configured. Please update the product master.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Items ({orderItems.length})
                  </span>
                  {orderItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrderItems([])}
                    >
                      Clear All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No items in order. Search and add products above.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.productName}</h4>
                          <p className="text-sm text-gray-600">
                            {item.color}, {item.size} • LKR {item.unitPrice} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-16 text-center"
                              min="1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right min-w-20">
                            <div className="font-medium">LKR {item.total}</div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-700 p-1"
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Order Summary */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any special instructions or notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between font-bold text-xl border-t pt-2">
                    <span>Total:</span>
                    <span>LKR {total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={orderItems.length === 0 || gpsCoordinates.latitude === 0}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-3"
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

export default POSPurchaseForm;
