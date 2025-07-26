import { useState, useRef } from 'react';
import { User } from '@/types/auth';
import { SalesOrder, SalesOrderItem } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { ArrowLeft, Search, Plus, Minus, Trash, MapPin, AlertTriangle, ShoppingCart } from 'lucide-react';

interface POSOrderFormProps {
  user: User;
  onSubmit: (order: Omit<SalesOrder, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const POSOrderForm = ({ user, onSubmit, onCancel }: POSOrderFormProps) => {
  // Demo data
  const customers: Customer[] = [
    { id: '1', name: 'Sharma Electronics', phone: '+91 98765 43210', address: '123 Main Street, Delhi', agencyId: 'agency-1', gpsCoordinates: { latitude: 28.6139, longitude: 77.2090 }, createdAt: new Date(), createdBy: 'john' },
    { id: '2', name: 'Modern Clothing Store', phone: '+91 87654 32109', address: '456 Shopping Complex, Mumbai', agencyId: 'agency-1', gpsCoordinates: { latitude: 19.0760, longitude: 72.8777 }, createdAt: new Date(), createdBy: 'john' }
  ];

  const products: Product[] = [
    { id: '1', name: 'Classic Cotton Shirt', category: 'Men\'s Wear', subCategory: 'Shirts', colors: ['White', 'Blue', 'Black'], sizes: ['S', 'M', 'L', 'XL'], sellingPrice: 899, billingPrice: 599 },
    { id: '2', name: 'Formal Trousers', category: 'Men\'s Wear', subCategory: 'Trousers', colors: ['Black', 'Navy', 'Gray'], sizes: ['30', '32', '34', '36'], sellingPrice: 1299, billingPrice: 899 },
    { id: '3', name: 'Casual T-Shirt', category: 'Men\'s Wear', subCategory: 'T-Shirts', colors: ['White', 'Black', 'Red'], sizes: ['S', 'M', 'L', 'XL'], sellingPrice: 499, billingPrice: 299 }
  ];

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.subCategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = subtotal - discountAmount;
  const requiresApproval = discountPercentage > 20;

  const addProductToOrder = (product: Product, color: string, size: string, quantity: number = 1) => {
    const existingItemIndex = orderItems.findIndex(
      item => item.productId === product.id && item.color === color && item.size === size
    );

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].unitPrice * updatedItems[existingItemIndex].quantity;
      setOrderItems(updatedItems);
    } else {
      // Add new item
      const newItem: SalesOrderItem = {
        id: Date.now().toString(),
        productId: product.id,
        productName: product.name,
        color,
        size,
        quantity,
        unitPrice: product.sellingPrice,
        total: product.sellingPrice * quantity
      };
      setOrderItems([...orderItems, newItem]);
    }
    
    setSearchTerm('');
    setShowProductSearch(false);
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
        },
        () => {
          setGpsCoordinates({
            latitude: 28.6139 + Math.random() * 0.01,
            longitude: 77.2090 + Math.random() * 0.01
          });
        }
      );
    }
  };

  const handleSubmit = () => {
    if (!selectedCustomer || orderItems.length === 0 || gpsCoordinates.latitude === 0) {
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

  const filteredCustomers = user.role === 'superuser' 
    ? customers 
    : customers.filter(c => c.agencyId === user.agencyId);

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
            <h2 className="text-xl font-bold">POS Sales Order</h2>
            <p className="text-sm text-gray-600">Quick product entry system</p>
          </div>
          <Button
            onClick={captureGPS}
            variant="outline"
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            {gpsCoordinates.latitude !== 0 ? 'GPS Captured' : 'Capture GPS'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Product Search & Entry */}
          <div className="lg:col-span-2 space-y-4">
            {/* Customer Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCustomers.map((customer) => (
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
              </CardContent>
            </Card>

            {/* Product Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Add Products
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="Search products... (Type product name, category, etc.)"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowProductSearch(e.target.value.length > 0);
                    }}
                    className="text-lg p-3"
                    autoFocus
                  />
                  
                  {showProductSearch && searchTerm && (
                    <Card className="absolute top-full left-0 right-0 z-10 mt-1 max-h-80 overflow-auto">
                      <CardContent className="p-2">
                        <Command>
                          <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            <CommandGroup>
                              {filteredProducts.map((product) => (
                                <div key={product.id} className="p-2 border-b last:border-b-0">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-gray-600">{product.category} • LKR {product.sellingPrice}</div>
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    {product.colors.map((color) => (
                                      <div key={color}>
                                        {product.sizes.map((size) => (
                                          <Button
                                            key={`${color}-${size}`}
                                            size="sm"
                                            variant="outline"
                                            className="mr-1 mb-1"
                                            onClick={() => addProductToOrder(product, color, size)}
                                          >
                                            {color} - {size}
                                          </Button>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </CardContent>
                    </Card>
                  )}
                </div>
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
                    className="text-lg"
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
                  <div className="flex justify-between text-lg">
                    <span>Subtotal:</span>
                    <span>LKR {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({discountPercentage}%):</span>
                    <span>-LKR {discountAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xl border-t pt-2">
                    <span>Total:</span>
                    <span>LKR {total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedCustomer || orderItems.length === 0 || gpsCoordinates.latitude === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
                  >
                    Create Order
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

export default POSOrderForm;
