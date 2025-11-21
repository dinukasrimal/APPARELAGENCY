import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { SalesOrderItem } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Plus, Trash2, ShoppingCart, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CustomerSearch from '@/components/customers/CustomerSearch';
import { useDraftSalesOrder } from '@/hooks/useDraftSalesOrder';
import { useDiscountValidation } from '@/hooks/useDiscountValidation';
import { getAgencyPriceType, getProductPriceForAgency, type PriceType } from '@/utils/agencyPricing';

interface EnhancedSalesOrderFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  onSuccess: () => void;
  onCancel: () => void;
  editingOrder?: any; // For editing existing orders
}

interface OrderSummaryItem extends SalesOrderItem {
  tempId: string;
}

const EnhancedSalesOrderForm = ({ 
  user, 
  customers, 
  products, 
  onSuccess, 
  onCancel,
  editingOrder 
}: EnhancedSalesOrderFormProps) => {
  const { 
    draft, 
    hasUnsavedChanges, 
    updateCustomer, 
    updateItems, 
    updateDiscount, 
    resetOrder, 
    clearDraft, 
    changeCustomer 
  } = useDraftSalesOrder();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [productGridItems, setProductGridItems] = useState<Array<{
    product: Product;
    color: string;
    sizes: Array<{ size: string; quantity: number; }>;
  }>>([]);
  const [orderSummary, setOrderSummary] = useState<OrderSummaryItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [agencyPriceType, setAgencyPriceType] = useState<PriceType>('billing_price');
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const { toast } = useToast();
  const { agencyDiscountLimit, validateDiscount, loading: discountLoading } = useDiscountValidation(user);

  // Load agency pricing preference
  useEffect(() => {
    const loadAgencyPricing = async () => {
      if (user.agencyId) {
        const priceType = await getAgencyPriceType(user.agencyId);
        setAgencyPriceType(priceType);
      }
    };
    loadAgencyPricing();
  }, [user.agencyId]);

  // Load draft or editing order on mount
  useEffect(() => {
    if (editingOrder) {
      setIsEditing(true);
      const customer = customers.find(c => c.id === editingOrder.customerId);
      if (customer) {
        setSelectedCustomer(customer);
        updateCustomer(customer);
      }
      
      const orderItems = editingOrder.items.map((item: any) => ({
        ...item,
        tempId: `${item.productId}-${item.color}-${item.size}-${Date.now()}`
      }));
      setOrderSummary(orderItems);
      updateItems(orderItems);
      setDiscountPercentage(editingOrder.discountPercentage || 0);
      updateDiscount(editingOrder.discountPercentage || 0);
    } else if (draft.customerId && !isEditing) {
      // Load from draft
      const customer = customers.find(c => c.id === draft.customerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
      
      const draftItems = draft.items.map(item => ({
        ...item,
        tempId: `${item.productId}-${item.color}-${item.size}-${Date.now()}`
      }));
      setOrderSummary(draftItems);
      setDiscountPercentage(draft.discountPercentage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingOrder?.id, draft.customerId, customers.length, isEditing]);

  // Save to draft on changes
  useEffect(() => {
    if (!isEditing && selectedCustomer) {
      updateCustomer(selectedCustomer);
    }
  }, [selectedCustomer, isEditing, updateCustomer]);

  useEffect(() => {
    if (!isEditing) {
      updateItems(orderSummary);
    }
  }, [orderSummary, isEditing, updateItems]);

  // Remove automatic discount draft updates to prevent infinite loop
  // Discount will be saved when user manually changes it

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleCustomerChange = () => {
    setSelectedCustomer(null);
    changeCustomer();
    setOrderSummary([]);
    setDiscountPercentage(0);
    toast({
      title: "Customer Changed",
      description: "Order has been reset due to customer change"
    });
  };

  // ... keep existing code (categories, subCategories, colors logic)
  const categories = [...new Set(products.map(p => p.category))];
  const subCategories = selectedCategory 
    ? [...new Set(products.filter(p => p.category === selectedCategory).map(p => p.subCategory))]
    : [];
  const colors = selectedCategory && selectedSubCategory
    ? [...new Set(products
        .filter(p => p.category === selectedCategory && p.subCategory === selectedSubCategory)
        .flatMap(p => p.colors))]
    : [];

  // Custom sorting function for product names
  const sortProductsByName = (products: Product[]) => {
    return products.sort((a, b) => {
      const extractSizeFromName = (name: string) => {
        // Check for size patterns at the end of product name
        const sizePatterns = [
          // Clothing sizes: S, M, L, XL, 2XL, 3XL, 4XL
          /\b(S|M|L|XL|2XL|3XL|4XL)$/i,
          // Numeric sizes: 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42
          /\b(20|22|24|26|28|30|32|34|36|38|40|42)$/,
          // Larger numeric sizes: 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100
          /\b(50|55|60|65|70|75|80|85|90|95|100)$/,
          // Negative sizes: -50, -55, -60, -65, -70, -75, -80, -85, -90, -95, -100
          /\b(-50|-55|-60|-65|-70|-75|-80|-85|-90|-95|-100)$/
        ];

        for (const pattern of sizePatterns) {
          const match = name.match(pattern);
          if (match) {
            return match[1];
          }
        }
        return null;
      };

      const getSizeOrder = (size: string | null) => {
        if (!size) return 999; // No size pattern found, put at end

        // Clothing sizes order
        const clothingSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        const clothingIndex = clothingSizes.indexOf(size.toUpperCase());
        if (clothingIndex !== -1) return clothingIndex;

        // Numeric sizes 20-42
        const numericSmall = ['20', '22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42'];
        const numericSmallIndex = numericSmall.indexOf(size);
        if (numericSmallIndex !== -1) return numericSmallIndex + 100;

        // Numeric sizes 50-100
        const numericLarge = ['50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100'];
        const numericLargeIndex = numericLarge.indexOf(size);
        if (numericLargeIndex !== -1) return numericLargeIndex + 200;

        // Negative sizes -50 to -100
        const negativeSizes = ['-50', '-55', '-60', '-65', '-70', '-75', '-80', '-85', '-90', '-95', '-100'];
        const negativeIndex = negativeSizes.indexOf(size);
        if (negativeIndex !== -1) return negativeIndex + 300;

        return 999;
      };

      const sizeA = extractSizeFromName(a.name);
      const sizeB = extractSizeFromName(b.name);
      
      const orderA = getSizeOrder(sizeA);
      const orderB = getSizeOrder(sizeB);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // If same size order or no size pattern, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  useEffect(() => {
    if (selectedCategory && selectedSubCategory && selectedColor) {
      const filteredProducts = products.filter(p => 
        p.category === selectedCategory && 
        p.subCategory === selectedSubCategory && 
        p.colors.includes(selectedColor)
      );

      // Sort products using custom sorting logic
      const sortedProducts = sortProductsByName(filteredProducts);

      setProductGridItems(sortedProducts.map(product => ({
        product,
        color: selectedColor,
        sizes: product.sizes.map(size => ({ size, quantity: 0 }))
      })));
    } else {
      setProductGridItems([]);
    }
  }, [selectedCategory, selectedSubCategory, selectedColor, products]);

  const getVariantKey = useCallback((productId: string, color: string, size: string) => {
    return [productId, color?.trim().toLowerCase() || 'default', size?.trim().toLowerCase() || 'default'].join('::');
  }, []);

  const loadInventory = useCallback(async () => {
    if (!user.agencyId) {
      setInventoryMap({});
      return;
    }

    try {
      setInventoryLoading(true);
      // First try direct matched_product_id -> product.id mapping from raw transactions
      const { data: matchedRows, error: matchedError } = await supabase
        .from('external_inventory_management')
        .select('matched_product_id, color, size, quantity')
        .eq('agency_id', user.agencyId)
        .eq('approval_status', 'approved')
        .not('matched_product_id', 'is', null);

      if (matchedError) {
        throw matchedError;
      }

      const unofficialTotals: Record<string, number> = {};
      (matchedRows || []).forEach(row => {
        if (!row.matched_product_id) return;
        const key = getVariantKey(row.matched_product_id, row.color || 'default', row.size || 'default');
        unofficialTotals[key] = (unofficialTotals[key] || 0) + (row.quantity ?? 0);
      });

      // Also pull stock summary by name as a fallback when matched_product_id is missing
      const { data: summaryRows, error: summaryError } = await supabase
        .from('external_inventory_stock_summary')
        .select('product_name, color, size, current_stock')
        .eq('agency_id', user.agencyId);

      if (summaryError) {
        throw summaryError;
      }

      const normalize = (value?: string | null) => (value || '').trim().toLowerCase();
      const productsByName = new Map<string, string>();
      products.forEach((p) => {
        if (p.name) productsByName.set(normalize(p.name), p.id);
        if (p.description) productsByName.set(normalize(p.description), p.id);
      });

      const nextMap: Record<string, number> = { ...unofficialTotals };
      (summaryRows || []).forEach(item => {
        const productId =
          productsByName.get(normalize(item.product_name)) ||
          products.find(p =>
            normalize(item.product_name).includes(normalize(p.name)) ||
            normalize(item.product_name).includes(normalize(p.description))
          )?.id;

        if (!productId) {
          return;
        }

        const colorValue = item.color || 'default';
        const sizeValue = item.size || 'default';
        const key = getVariantKey(productId, colorValue, sizeValue);
        const colorFallbackKey = getVariantKey(productId, colorValue, 'default');
        const sizeFallbackKey = getVariantKey(productId, 'default', sizeValue);
        const defaultKey = getVariantKey(productId, 'default', 'default');

        const stockValue = item.current_stock ?? 0;

        // Prefer matched_product_id totals; otherwise, hydrate all fallback keys with the same value.
        if (nextMap[key] === undefined) nextMap[key] = stockValue;
        if (nextMap[colorFallbackKey] === undefined) nextMap[colorFallbackKey] = stockValue;
        if (nextMap[sizeFallbackKey] === undefined) nextMap[sizeFallbackKey] = stockValue;
        if (nextMap[defaultKey] === undefined) nextMap[defaultKey] = stockValue;
      });

      setInventoryMap(nextMap);
    } catch (error) {
      console.error('Failed to load inventory stock for sales order form:', error);
      toast({
        title: 'Inventory Data Unavailable',
        description: 'Could not fetch current stock. You can still create the order.',
        variant: 'destructive'
      });
    } finally {
      setInventoryLoading(false);
    }
  }, [getVariantKey, products, toast, user.agencyId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const getAvailableStock = (productId: string, color: string, size: string) => {
    const primaryKey = getVariantKey(productId, color, size);
    const colorFallbackKey = getVariantKey(productId, color, 'default');
    const sizeFallbackKey = getVariantKey(productId, 'default', size);
    const defaultKey = getVariantKey(productId, 'default', 'default');

    return inventoryMap[primaryKey] ??
      inventoryMap[colorFallbackKey] ??
      inventoryMap[sizeFallbackKey] ??
      inventoryMap[defaultKey];
  };

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
            unitPrice: getProductPriceForAgency(gridItem.product, agencyPriceType),
            total: getProductPriceForAgency(gridItem.product, agencyPriceType) * sizeItem.quantity
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

  // ... keep existing code (captureGPS function)
  const captureGPS = async (): Promise<{ latitude: number; longitude: number }> => {
    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
          );
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } else {
        throw new Error('Geolocation not supported');
      }
    } catch (error) {
      // Fallback for demo
      return {
        latitude: 7.8731 + Math.random() * 0.01,
        longitude: 80.7718 + Math.random() * 0.01
      };
    }
  };

  const calculateTotals = () => {
    const subtotal = orderSummary.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * discountPercentage) / 100;
    const total = subtotal - discountAmount;

    return { subtotal, discountAmount, total };
  };

  const createInventoryTransactions = async (salesOrderId: string, orderItems: OrderSummaryItem[]) => {
    try {
      const transactions = orderItems.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        transaction_type: 'invoice_creation',
        quantity: -item.quantity, // Negative for stock reduction
        reference_id: salesOrderId,
        reference_name: `Sales Order ${salesOrderId}`,
        user_id: user.id,
        agency_id: user.agencyId,
        notes: `Stock reduced for sales order ${salesOrderId}`
      }));

      // Use the edge function to insert inventory transactions
      const { error } = await supabase.functions.invoke('insert-inventory-transactions', {
        body: { transactions }
      });

      if (error) {
        console.error('Error creating inventory transactions:', error);
        // Don't throw error to prevent order creation failure
        console.log('Continuing without inventory tracking...');
      }
    } catch (error) {
      console.error('Error calling inventory transaction function:', error);
      // Don't throw error to prevent order creation failure
    }
  };

  const submitSalesOrder = async () => {
    if (!selectedCustomer || orderSummary.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select customer and add items",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Capture GPS coordinates automatically on save
      toast({
        title: "Capturing location",
        description: "Getting GPS coordinates..."
      });

      const coords = await captureGPS();
      setGpsCoordinates(coords);

      const { subtotal, discountAmount, total } = calculateTotals();
      
      // Validate discount using agency limits
      const discountValidation = validateDiscount(discountPercentage);
      const requiresApproval = discountValidation.requiresApproval;
      const status = requiresApproval ? 'pending' : 'approved';

      let salesOrderData;
      let orderData;

      if (isEditing && editingOrder) {
        // Update existing order
        salesOrderData = {
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          subtotal,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          total,
          status,
          requires_approval: requiresApproval,
          latitude: coords.latitude,
          longitude: coords.longitude
        };

        const { data, error: orderError } = await supabase
          .from('sales_orders')
          .update(salesOrderData)
          .eq('id', editingOrder.id)
          .select()
          .single();

        if (orderError) throw orderError;
        orderData = data;

        // Delete existing items and insert new ones
        await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', editingOrder.id);
      } else {
        // Create new order
        salesOrderData = {
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          agency_id: user.agencyId,
          subtotal,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          total,
          status,
          requires_approval: requiresApproval,
          latitude: coords.latitude,
          longitude: coords.longitude,
          created_by: user.id
        };

        const { data, error: orderError } = await supabase
          .from('sales_orders')
          .insert(salesOrderData)
          .select()
          .single();

        if (orderError) throw orderError;
        orderData = data;
      }

      // Create order items
      const orderItems = orderSummary.map(item => ({
        sales_order_id: orderData.id,
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

      // Create inventory transactions for stock reduction if order is approved
      if (status === 'approved') {
        await createInventoryTransactions(orderData.id, orderSummary);
      }

      toast({
        title: "Sales Order Saved",
        description: `Order ${orderData.id} has been ${requiresApproval ? 'submitted for approval' : 'approved'} ${discountPercentage > 0 ? `with ${discountPercentage}% discount` : ''}${discountValidation.message ? ` - ${discountValidation.message}` : ''}`
      });

      // Clear draft if not editing
      if (!isEditing) {
        clearDraft();
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving sales order:', error);
      toast({
        title: "Error",
        description: "Failed to save sales order",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, discountAmount, total } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Sales Order' : 'Create Sales Order'}
          </h2>
          {hasUnsavedChanges && !isEditing && (
            <p className="text-sm text-orange-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              You have unsaved changes in draft
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomerSearch
                customers={customers}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={handleCustomerSelect}
                onCustomerChange={handleCustomerChange}
                disabled={isSubmitting}
              />
              
              {gpsCoordinates.latitude !== 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Location will be captured on save</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Current: {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Product Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Categories Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Select Category</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {categories.map((category) => (
                    <Card
                      key={category}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedCategory === category ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedSubCategory('');
                        setSelectedColor('');
                      }}
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
                  <Label className="text-base font-semibold mb-3 block">Select Sub Category</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {subCategories.map((subCategory) => (
                      <Card
                        key={subCategory}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedSubCategory === subCategory ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          setSelectedSubCategory(subCategory);
                          setSelectedColor('');
                        }}
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
                  <Label className="text-base font-semibold mb-3 block">Select Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <Badge
                        key={color}
                        variant={selectedColor === color ? "default" : "outline"}
                        className={`cursor-pointer py-2 px-4 text-sm transition-all duration-200 hover:scale-105 ${
                          selectedColor === color ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => setSelectedColor(color)}
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

              {/* Product Grid */}
              {productGridItems.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Enter Quantities</h4>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {productGridItems.map((gridItem, productIndex) => (
                      <div key={gridItem.product.id} className="border rounded-lg p-4">
                        <h5 className="font-medium mb-3">{gridItem.product.name}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {gridItem.sizes.map((sizeItem, sizeIndex) => {
                            const availableStock = getAvailableStock(gridItem.product.id, gridItem.color, sizeItem.size);
                            const stockClass = inventoryLoading
                              ? 'text-gray-400'
                              : availableStock === undefined
                                ? 'text-gray-400'
                                : availableStock <= 0
                                  ? 'text-red-600'
                                  : availableStock <= 5
                                    ? 'text-orange-500'
                                    : 'text-green-600';
                            const stockLabel = inventoryLoading
                              ? 'Stock: —'
                              : `Stock: ${Math.max(0, availableStock ?? 0)}`;

                            return (
                              <div key={sizeItem.size} className="space-y-1">
                                <Label className="text-sm">{sizeItem.size}</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={sizeItem.quantity}
                                    onChange={(e) => updateQuantity(productIndex, sizeIndex, parseInt(e.target.value) || 0)}
                                    placeholder="Qty"
                                    className="w-24"
                                  />
                                  <span className={`text-xs font-medium min-w-[70px] text-right ${stockClass}`}>
                                    {stockLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
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
        </div>

        {/* Right Panel - Order Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
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

                  {/* Discount Section */}
                  <div className="border-t pt-3 space-y-3">
                    <div>
                      <Label>Discount Percentage (%)</Label>
                      {!discountLoading && agencyDiscountLimit !== null && user.role !== 'superuser' && (
                        <p className="text-xs text-gray-600 mt-1">
                          Your agency limit: {agencyDiscountLimit}%
                        </p>
                      )}
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={discountPercentage}
                        onChange={(e) => {
                          const newDiscount = Number(e.target.value);
                          setDiscountPercentage(newDiscount);
                          if (!isEditing) {
                            updateDiscount(newDiscount);
                          }
                        }}
                        placeholder="0.00"
                        disabled={discountLoading}
                      />
                      {!discountLoading && discountPercentage > 0 && (() => {
                        const validation = validateDiscount(discountPercentage);
                        return validation.message && (
                          <div className={`text-sm mt-1 flex items-center gap-1 ${
                            validation.requiresApproval ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            <AlertTriangle className="h-3 w-3" />
                            {validation.message}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>LKR {subtotal.toLocaleString()}</span>
                      </div>
                      {discountPercentage > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount ({discountPercentage}%):</span>
                          <span>-LKR {discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>LKR {total.toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      onClick={submitSalesOrder}
                      disabled={isSubmitting || !selectedCustomer || orderSummary.length === 0}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Saving & Capturing GPS...' : isEditing ? 'Update Sales Order' : 'Submit Sales Order'}
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

export default EnhancedSalesOrderForm;
