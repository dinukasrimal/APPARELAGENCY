import { useEffect, useState } from 'react';
import { User } from '@/types/auth';
import { ReturnItem } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Trash2, User as UserIcon } from 'lucide-react';
import { getAgencyPriceType, getProductPriceForAgency, type PriceType } from '@/utils/agencyPricing';

interface CreateReturnFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  onSubmit: (returnData: any) => void;
  onCancel: () => void;
}

const CreateReturnForm = ({ user, customers, products, onSubmit, onCancel }: CreateReturnFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [priceType, setPriceType] = useState<PriceType>('selling_price');

  useEffect(() => {
    const loadPriceType = async () => {
      if (!user.agencyId) return;
      const pt = await getAgencyPriceType(user.agencyId);
      setPriceType(pt);
    };
    loadPriceType();
  }, [user.agencyId]);

  // Filter customers based on user role and search
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                         customer.phone.toLowerCase().includes(customerSearchTerm.toLowerCase());
    const matchesAgency = user.role === 'superuser' || customer.agencyId === user.agencyId;
    
    return matchesSearch && matchesAgency;
  });

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  const subCategories = selectedCategory
    ? Array.from(
        new Set(
          products
            .filter(p => p.category === selectedCategory)
            .map(p => p.subCategory)
            .filter(Boolean)
        )
      ).sort()
    : [];
  const availableColors = selectedCategory && selectedSubCategory
    ? Array.from(
        new Set(
          products
            .filter(p => p.category === selectedCategory && p.subCategory === selectedSubCategory)
            .flatMap(p => p.colors || [])
        )
      ).sort((a, b) => a.localeCompare(b))
    : [];
  const filteredProducts = selectedCategory && selectedSubCategory && selectedColor
    ? products.filter(
        p =>
          p.category === selectedCategory &&
          p.subCategory === selectedSubCategory &&
          (p.colors || []).includes(selectedColor)
      )
    : [];

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubCategory('');
    setSelectedColor('');
  };

  const handleSubCategoryChange = (subCategory: string) => {
    setSelectedSubCategory(subCategory);
    setSelectedColor('');
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
  };

  const updateReturnItem = (returnItemId: string, field: string, value: any) => {
    setReturnItems(prev => {
      return prev.map(item => 
        item.id === returnItemId 
          ? { 
              ...item, 
              [field]: value,
              total: field === 'quantityReturned' ? item.unitPrice * value : item.total
            }
          : item
      );
    });
  };

  const updateQuantity = (returnItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setReturnItems(prev => prev.filter(item => item.id !== returnItemId));
      return;
    }

    setReturnItems(prev =>
      prev.map(item =>
        item.id === returnItemId
          ? { ...item, quantityReturned: quantity, total: item.unitPrice * quantity }
          : item
      )
    );
  };

  const addReturnItem = (product: Product, size: string) => {
    const color = selectedColor || product.colors[0] || 'Default';
    const unitPrice = getProductPriceForAgency(product, priceType) || 0;
    const existingIndex = returnItems.findIndex(
      item => item.productId === product.id && item.color === color && item.size === size
    );

    if (existingIndex >= 0) {
      const updated = [...returnItems];
      const newQty = updated[existingIndex].quantityReturned + 1;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantityReturned: newQty,
        total: unitPrice * newQty
      };
      setReturnItems(updated);
      return;
    }

    const id = `${product.id}-${color}-${size}-${Date.now()}`;
    const newItem: ReturnItem = {
      id,
      invoiceItemId: null,
      productId: product.id,
      productName: product.name,
      color,
      size,
      quantityReturned: 1,
      originalQuantity: 1,
      unitPrice,
      total: unitPrice,
      reason: ''
    };

    setReturnItems(prev => [...prev, newItem]);
  };

  const subtotalReturnAmount = returnItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = discountType === 'percentage'
    ? (subtotalReturnAmount * discountValue) / 100
    : discountValue;
  const totalReturnAmount = Math.max(0, subtotalReturnAmount - discountAmount);

  const handleSubmit = async () => {
    if (!selectedCustomer || !reason || returnItems.length === 0) {
      return;
    }

    try {
      // Get current location with better error handling
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          }
        );
      });

      const returnData = {
        invoiceId: null, // invoice allocation deferred
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        agencyId: selectedCustomer.agencyId,
        items: returnItems,
        subtotal: subtotalReturnAmount,
        total: totalReturnAmount,
        discountType,
        discountValue,
        discountAmount,
        reason,
        status: 'approved' as const,
        gpsCoordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      };

      console.log('Submitting return data:', returnData);
      await onSubmit(returnData);
    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback coordinates if location access is denied
      const returnData = {
        invoiceId: null, // invoice allocation deferred
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        agencyId: selectedCustomer.agencyId,
        items: returnItems,
        subtotal: subtotalReturnAmount,
        total: totalReturnAmount,
        discountType,
        discountValue,
        discountAmount,
        reason,
        status: 'approved' as const,
        gpsCoordinates: {
          latitude: 7.8731 + Math.random() * 0.01,
          longitude: 80.7718 + Math.random() * 0.01
        }
      };
      
      console.log('Submitting return data with fallback location:', returnData);
      await onSubmit(returnData);
    }
  };

  const resetSelection = () => {
    setSelectedCustomerId('');
    setReturnItems([]);
    setReason('');
    setSelectedCategory('');
    setSelectedSubCategory('');
    setSelectedColor('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Returns
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Process Return</h2>
          <p className="text-gray-600">Select a customer; linking an invoice is optional and can be done later</p>
        </div>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Step 1: Select Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers by name or phone..."
              value={customerSearchTerm}
              onChange={(e) => setCustomerSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCustomerId} onValueChange={(value) => {
            setSelectedCustomerId(value);
            setReturnItems([]);
            setReason('');
            setSelectedCategory('');
            setSelectedSubCategory('');
            setSelectedColor('');
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {filteredCustomers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCustomer && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">Selected Customer:</h4>
              <p className="text-blue-800">{selectedCustomer.name}</p>
              <p className="text-sm text-blue-700">{selectedCustomer.phone} • {selectedCustomer.address}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return Items Entry */}
      {selectedCustomer && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select Items to Return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
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

              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium mb-2">Sub-category</label>
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

              {selectedSubCategory && (
                <div>
                  <label className="block text-sm font-medium mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <Button
                        key={color}
                        type="button"
                        variant={selectedColor === color ? 'default' : 'outline'}
                        className={`py-2 px-4 text-sm ${
                          selectedColor === color ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => handleColorChange(color)}
                      >
                        {color}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedCategory && selectedSubCategory && selectedColor && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-800">
                  Products - {selectedCategory} / {selectedSubCategory} / {selectedColor}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 p-3 text-left">Product</th>
                        <th className="border border-gray-200 p-3 text-left">Size</th>
                        <th className="border border-gray-200 p-3 text-left">Price</th>
                        <th className="border border-gray-200 p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product =>
                        product.sizes.map(size => {
                          const unitPrice = getProductPriceForAgency(product, priceType) || 0;
                          return (
                          <tr key={`${product.id}-${size}`}>
                            <td className="border border-gray-200 p-3">{product.name}</td>
                            <td className="border border-gray-200 p-3">{size}</td>
                            <td className="border border-gray-200 p-3">LKR {unitPrice.toLocaleString()}</td>
                            <td className="border border-gray-200 p-3">
                              <Button size="sm" onClick={() => addReturnItem(product, size)}>
                                Add
                              </Button>
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {returnItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-800">Return Items</h4>
                <div className="space-y-3">
                  {returnItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-gray-600">Color: {item.color} • Size: {item.size}</p>
                          <p className="text-sm text-gray-600">Unit Price: LKR {item.unitPrice}</p>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setReturnItems(prev => prev.filter(r => r.id !== item.id))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Qty to Return</p>
                          <Input
                            type="number"
                            min="0"
                            value={item.quantityReturned}
                            onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                            className="w-24 text-center"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Reason for return:</p>
                        <Textarea
                          placeholder="Explain why this item is being returned"
                          value={item.reason}
                          onChange={(e) => updateReturnItem(item.id, 'reason', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Return Summary */}
      {returnItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Return Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Overall Return Reason:</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide an overall reason for this return..."
                className="mt-1"
              />
            </div>

            <div className="space-y-3 p-3 bg-red-50 rounded">
              <div className="flex justify-between">
                <span className="font-medium">Items to Return:</span>
                <span>{returnItems.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>LKR {subtotalReturnAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'amount')}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percent (%)</SelectItem>
                      <SelectItem value="amount">Fixed (LKR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-gray-600">
                    Discount: LKR {discountAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold text-red-600">
                  <span>Total Return Amount:</span>
                  <span>LKR {totalReturnAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={returnItems.length === 0 || !reason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                Process Return
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateReturnForm;
