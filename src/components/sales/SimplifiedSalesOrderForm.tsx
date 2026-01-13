import { useState, useEffect, useMemo } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SalesOrderItem {
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SimplifiedSalesOrderFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  onSuccess: () => void;
  onCancel: () => void;
}

const SimplifiedSalesOrderForm = ({ 
  user, 
  customers, 
  products, 
  onSuccess, 
  onCancel 
}: SimplifiedSalesOrderFormProps) => {
  const [customerId, setCustomerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [gpsCoordinates, setGpsCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const productNameCollator = useMemo(
    () => new Intl.Collator('en', { numeric: true, sensitivity: 'base' }),
    []
  );

  // Get unique categories and subcategories
  const categories = [...new Set(products.map(p => p.category))];
  const subCategories = selectedCategory 
    ? [...new Set(products.filter(p => p.category === selectedCategory).map(p => p.subCategory))]
    : [];
  
  // Get available colors for the selected subcategory
  const availableColors = selectedCategory && selectedSubCategory
    ? [...new Set(products
        .filter(p => p.category === selectedCategory && p.subCategory === selectedSubCategory)
        .flatMap(p => p.colors)
      )]
    : [];

  // Get products for selected category, subcategory, and color
  const filteredProducts = useMemo(() => {
    const matches = products.filter(p => 
      p.category === selectedCategory && 
      p.subCategory === selectedSubCategory &&
      (selectedColor ? p.colors.includes(selectedColor) : true)
    );

    return matches.sort((a, b) => productNameCollator.compare(a.name, b.name));
  }, [products, selectedCategory, selectedSubCategory, selectedColor, productNameCollator]);

  useEffect(() => {
    // Get GPS coordinates on component mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          console.log('GPS coordinates captured:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Error getting GPS coordinates:', error);
          // Set default coordinates if GPS fails
          setGpsCoordinates({ latitude: 0, longitude: 0 });
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser');
      setGpsCoordinates({ latitude: 0, longitude: 0 });
    }
  }, []);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubCategory('');
    setSelectedColor('');
    setItems([]);
  };

  const handleSubCategoryChange = (subCategory: string) => {
    setSelectedSubCategory(subCategory);
    setSelectedColor('');
    setItems([]);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    setItems([]);
  };

  const addItemToOrder = (product: Product, size: string, quantity: number) => {
    if (!selectedColor) return;

    const existingItemIndex = items.findIndex(
      item => item.productId === product.id && 
               item.color === selectedColor && 
               item.size === size
    );

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += quantity;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unitPrice;
      setItems(updatedItems);
    } else {
      // Add new item
      const newItem: SalesOrderItem = {
        productId: product.id,
        productName: product.name,
        color: selectedColor,
        size,
        quantity,
        unitPrice: product.sellingPrice,
        total: quantity * product.sellingPrice
      };
      setItems([...items, newItem]);
    }
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    updatedItems[index].total = quantity * updatedItems[index].unitPrice;
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = subtotal - discountAmount;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId || items.length === 0 || !gpsCoordinates) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and ensure GPS coordinates are captured",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) throw new Error('Customer not found');

      // Determine approval status based on discount
      const requiresApproval = discountPercentage > 20;
      const status = requiresApproval ? 'pending' : 'approved';

      // Create sales order
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          customer_id: customerId,
          customer_name: customer.name,
          agency_id: user.agencyId || user.id,
          subtotal,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          total,
          status,
          requires_approval: requiresApproval,
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          created_by: user.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create sales order items
      const orderItems = items.map(item => ({
        sales_order_id: salesOrder.id,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: requiresApproval 
          ? "Sales order created and sent for approval"
          : "Sales order created and approved successfully",
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating sales order:', error);
      toast({
        title: "Error",
        description: "Failed to create sales order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Create Sales Order</h2>
          <p className="text-gray-600">Add products to create a new sales order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Customer</label>
                <Select value={customerId} onValueChange={setCustomerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-600">
                  {gpsCoordinates ? 'GPS coordinates captured' : 'Capturing GPS...'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Product Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-6">
              {/* Categories Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">Category</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {categories.map((category) => (
                    <Card
                      key={category}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedCategory === category ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleCategoryChange(category)}
                    >
                      <CardContent className="p-4 text-center">
                        <h3 className="font-semibold text-sm">{category}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {products.filter(p => p.category === category).length} products
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Sub Categories Selection */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium mb-3">Sub-category</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {subCategories.map((subCategory) => (
                      <Card
                        key={subCategory}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedSubCategory === subCategory ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => handleSubCategoryChange(subCategory)}
                      >
                        <CardContent className="p-4 text-center">
                          <h3 className="font-semibold text-sm">{subCategory}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {products.filter(p => p.category === selectedCategory && p.subCategory === subCategory).length} products
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Colors Selection */}
              {selectedSubCategory && (
                <div>
                  <label className="block text-sm font-medium mb-3">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <Badge
                        key={color}
                        variant={selectedColor === color ? "default" : "outline"}
                        className={`cursor-pointer py-2 px-4 text-sm transition-all duration-200 hover:scale-105 ${
                          selectedColor === color ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => handleColorChange(color)}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: color.toLowerCase() }}
                          />
                          {color}
                        </div>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedCategory && selectedSubCategory && selectedColor && (
              <div>
                <h4 className="font-medium mb-3">Products - {selectedCategory} / {selectedSubCategory} / {selectedColor}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 p-3 text-left">Product</th>
                        <th className="border border-gray-200 p-3 text-left">Size</th>
                        <th className="border border-gray-200 p-3 text-left">Price</th>
                        <th className="border border-gray-200 p-3 text-left">Quantity</th>
                        <th className="border border-gray-200 p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => 
                        product.sizes.map(size => (
                          <ProductRow 
                            key={`${product.id}-${size}`}
                            product={product}
                            size={size}
                            onAddItem={addItemToOrder}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredProducts.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No products found for the selected category, sub-category, and color
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 p-3 text-left">Product</th>
                      <th className="border border-gray-200 p-3 text-left">Color</th>
                      <th className="border border-gray-200 p-3 text-left">Size</th>
                      <th className="border border-gray-200 p-3 text-left">Quantity</th>
                      <th className="border border-gray-200 p-3 text-left">Unit Price</th>
                      <th className="border border-gray-200 p-3 text-left">Total</th>
                      <th className="border border-gray-200 p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-200 p-3">{item.productName}</td>
                        <td className="border border-gray-200 p-3">{item.color}</td>
                        <td className="border border-gray-200 p-3">{item.size}</td>
                        <td className="border border-gray-200 p-3">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                            min="1"
                            className="w-20"
                          />
                        </td>
                        <td className="border border-gray-200 p-3">LKR {item.unitPrice.toLocaleString()}</td>
                        <td className="border border-gray-200 p-3 font-medium">LKR {item.total.toLocaleString()}</td>
                        <td className="border border-gray-200 p-3">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Total Quantity:</span>
                  <span className="font-medium">{totalQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Discount and Total */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Discount & Total</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Discount Type</label>
                <div className="flex gap-4 mb-2">
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
                <Input
                  type="number"
                  value={discountType === 'percentage' ? discountPercentage : discountAmountInput}
                  onChange={(e) => {
                    if (discountType === 'percentage') setDiscountPercentage(parseFloat(e.target.value) || 0);
                    else setDiscountAmountInput(parseFloat(e.target.value) || 0);
                  }}
                  min="0"
                  max={discountType === 'percentage' ? '100' : undefined}
                  step="0.1"
                  className="w-32"
                  placeholder={discountType === 'percentage' ? '0' : '0'}
                />
                {discountType === 'percentage' && discountPercentage > 20 && (
                  <Badge variant="outline" className="ml-2 text-orange-600 border-orange-600">
                    Requires Approval
                  </Badge>
                )}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
                {(discountType === 'percentage' ? discountPercentage > 0 : discountAmountInput > 0) && (
                <div className="flex justify-between text-green-600">
                    <span>Discount ({discountType === 'percentage' ? `${discountPercentage}%` : `LKR ${discountAmountInput}`}):</span>
                  <span>-LKR {discountAmount.toLocaleString()}</span>
                </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>LKR {total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button 
            type="submit" 
            disabled={isSubmitting || items.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? 'Creating...' : 'Create Sales Order'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

// Product Row Component for the table
const ProductRow = ({ 
  product, 
  size, 
  onAddItem 
}: { 
  product: Product; 
  size: string; 
  onAddItem: (product: Product, size: string, quantity: number) => void; 
}) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <tr>
      <td className="border border-gray-200 p-3">{product.name}</td>
      <td className="border border-gray-200 p-3">{size}</td>
      <td className="border border-gray-200 p-3">LKR {product.sellingPrice.toLocaleString()}</td>
      <td className="border border-gray-200 p-3">
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          min="1"
          className="w-20"
        />
      </td>
      <td className="border border-gray-200 p-3">
        <Button 
          size="sm" 
          onClick={() => onAddItem(product, size, quantity)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </td>
    </tr>
  );
};

export default SimplifiedSalesOrderForm;
