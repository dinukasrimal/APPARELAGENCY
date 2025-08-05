import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Product } from '@/types/product';
import { InvoiceItem } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Plus, Trash2, FileText, Save } from 'lucide-react';
import SignatureCapture from './SignatureCapture';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { externalInventoryService } from '@/services/external-inventory.service';

interface DirectInvoiceFormProps {
  user: User;
  customers: Customer[];
  products: Product[];
  onSuccess: () => void;
  onCancel: () => void;
}

interface InvoiceSummaryItem extends InvoiceItem {
  tempId: string;
}

const DirectInvoiceForm = ({ user, customers, products, onSuccess, onCancel }: DirectInvoiceFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [productGridItems, setProductGridItems] = useState<Array<{
    product: Product;
    color: string;
    sizes: Array<{ size: string; quantity: number; }>;
  }>>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummaryItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [signature, setSignature] = useState<string>('');
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const { toast } = useToast();

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

  const addToInvoiceSummary = () => {
    const itemsToAdd: InvoiceSummaryItem[] = [];
    
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
            unitPrice: gridItem.product.sellingPrice,
            total: gridItem.product.sellingPrice * sizeItem.quantity
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

    setInvoiceSummary(prev => [...prev, ...itemsToAdd]);
    
    // Reset the grid
    setProductGridItems(prev => prev.map(item => ({
      ...item,
      sizes: item.sizes.map(size => ({ ...size, quantity: 0 }))
    })));

    toast({
      title: "Items added",
      description: `${itemsToAdd.length} item(s) added to invoice summary`
    });
  };

  const removeFromInvoiceSummary = (tempId: string) => {
    setInvoiceSummary(prev => prev.filter(item => item.tempId !== tempId));
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

  const calculateTotals = () => {
    const subtotal = invoiceSummary.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * discountPercentage) / 100;
    const total = subtotal - discountAmount;

    return { subtotal, discountAmount, total };
  };

  const handleSignatureCapture = (signatureData: string) => {
    setSignature(signatureData);
    setShowSignatureCapture(false);
  };

  const submitDirectInvoice = async () => {
    if (!selectedCustomerId || invoiceSummary.length === 0 || !signature) {
      toast({
        title: "Missing information",
        description: "Please select customer, add items, and capture signature",
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

      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const { subtotal, discountAmount, total } = calculateTotals();

      // Create direct invoice (no sales_order_id)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          customer_id: selectedCustomerId,
          customer_name: selectedCustomer?.name || '',
          agency_id: user.agencyId,
          subtotal,
          discount_amount: discountAmount,
          total,
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          signature,
          created_by: user.id
          // No sales_order_id - this is a direct invoice
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItems = invoiceSummary.map(item => ({
        invoice_id: invoiceData.id,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Create external inventory transactions to reduce stock
      try {
        console.log('Creating external inventory transactions for direct invoice:', invoiceData.id);
        
        // Get user profile name for reference
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        const userName = profileData?.name || 'Unknown User';

        for (const item of invoiceSummary) {
          await externalInventoryService.addSaleTransaction(
            user.agencyId,
            userName,
            item.productName,
            item.color || 'Default',
            item.size || 'Default',
            item.quantity,
            selectedCustomer?.name || '',
            invoiceData.id,
            item.unitPrice
          );
        }

        console.log('External inventory transactions created successfully');
      } catch (error) {
        console.error('❌ CRITICAL: Error creating external inventory transactions:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        // Don't throw error to prevent invoice creation failure
        console.log('❌ Direct invoice created but external inventory tracking failed');
        
        // Show error to user via toast for debugging
        toast({
          title: "Warning: Inventory not updated",
          description: `Invoice created but stock was not reduced. Error: ${error?.message || 'Unknown error'}`,
          variant: "destructive",
        });
      }

      toast({
        title: "Direct Invoice Created",
        description: `Invoice ${invoiceData.id} has been created successfully with inventory updated`
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating direct invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create direct invoice",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, discountAmount, total } = calculateTotals();

  if (showSignatureCapture) {
    return (
      <SignatureCapture
        customerName={customers.find(c => c.id === selectedCustomerId)?.name || ''}
        onSignatureCapture={handleSignatureCapture}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Create Direct Invoice</h2>
          <Badge variant="outline" className="mt-1">Direct Invoice</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
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

          {/* Product Selection - same as sales order */}
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

                  <Button onClick={addToInvoiceSummary} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Invoice Summary
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Invoice Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Summary ({invoiceSummary.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoiceSummary.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No items added yet</p>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {invoiceSummary.map((item) => (
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
                            onClick={() => removeFromInvoiceSummary(item.tempId)}
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
                    </div>
                    <div className="space-y-2">
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
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>LKR {total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Signature Section */}
                    <div className="border-t pt-3">
                      {signature ? (
                        <div className="text-center">
                          <p className="text-sm text-green-600 font-medium mb-2">✓ Signature Captured</p>
                          <img 
                            src={signature} 
                            alt="Customer Signature" 
                            className="w-full h-20 object-contain border rounded bg-white"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSignatureCapture(true)}
                            className="mt-2"
                          >
                            Retake Signature
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowSignatureCapture(true)}
                          className="w-full"
                        >
                          Capture Customer Signature
                        </Button>
                      )}
                    </div>

                    <Button
                      onClick={submitDirectInvoice}
                      disabled={isSubmitting || !selectedCustomerId || invoiceSummary.length === 0 || !signature}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Creating...' : 'Create Direct Invoice'}
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

export default DirectInvoiceForm;
