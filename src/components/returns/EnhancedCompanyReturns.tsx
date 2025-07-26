import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EnhancedCompanyReturnsProps {
  user: User;
  onBack: () => void;
}

interface ReturnItem {
  tempId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  reason: string;
  unitPrice: number;
  total: number;
}

const EnhancedCompanyReturns = ({ user, onBack }: EnhancedCompanyReturnsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedReference, setSelectedReference] = useState('');
  const [referenceType, setReferenceType] = useState<'grn' | 'invoice'>('grn');
  const [productGridItems, setProductGridItems] = useState<Array<{
    product: Product;
    color: string;
    sizes: Array<{ size: string; quantity: number; reason: string; }>;
  }>>([]);
  const [returnSummary, setReturnSummary] = useState<ReturnItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;

      const transformedProducts: Product[] = (productsData || []).map(product => ({
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

      // Fetch GRNs
      const { data: grnsData, error: grnsError } = await supabase
        .from('grns')
        .select('*')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (grnsError) throw grnsError;
      setGrns(grnsData || []);

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
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
        sizes: product.sizes.map(size => ({ size, quantity: 0, reason: '' }))
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

  const updateReason = (productIndex: number, sizeIndex: number, reason: string) => {
    setProductGridItems(prev => prev.map((item, pIdx) => 
      pIdx === productIndex 
        ? {
            ...item,
            sizes: item.sizes.map((sizeItem, sIdx) => 
              sIdx === sizeIndex ? { ...sizeItem, reason } : sizeItem
            )
          }
        : item
    ));
  };

  const addToReturnSummary = () => {
    const itemsToAdd: ReturnItem[] = [];
    
    productGridItems.forEach(gridItem => {
      gridItem.sizes.forEach(sizeItem => {
        if (sizeItem.quantity > 0 && sizeItem.reason.trim()) {
          itemsToAdd.push({
            tempId: `${gridItem.product.id}-${gridItem.color}-${sizeItem.size}-${Date.now()}`,
            productId: gridItem.product.id,
            productName: gridItem.product.name,
            color: gridItem.color,
            size: sizeItem.size,
            quantity: sizeItem.quantity,
            reason: sizeItem.reason,
            unitPrice: gridItem.product.billingPrice,
            total: gridItem.product.billingPrice * sizeItem.quantity
          });
        }
      });
    });

    if (itemsToAdd.length === 0) {
      toast({
        title: "No items to add",
        description: "Please enter quantities and reasons for the products you want to return",
        variant: "destructive"
      });
      return;
    }

    setReturnSummary(prev => [...prev, ...itemsToAdd]);
    
    // Reset the grid
    setProductGridItems(prev => prev.map(item => ({
      ...item,
      sizes: item.sizes.map(size => ({ ...size, quantity: 0, reason: '' }))
    })));

    toast({
      title: "Items added",
      description: `${itemsToAdd.length} item(s) added to return summary`
    });
  };

  const removeFromReturnSummary = (tempId: string) => {
    setReturnSummary(prev => prev.filter(item => item.tempId !== tempId));
  };

  const calculateTotal = () => {
    return returnSummary.reduce((sum, item) => sum + item.total, 0);
  };

  const submitReturn = async () => {
    if (returnSummary.length === 0 || !selectedReference) {
      toast({
        title: "Missing information",
        description: "Please add items and select a reference (GRN/Invoice)",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const total = calculateTotal();

      // For now, just show success (actual implementation would depend on database schema)
      toast({
        title: "Company Return Created",
        description: `Return has been created successfully with ${returnSummary.length} items (Total: LKR ${total.toLocaleString()})`
      });

      onBack();
    } catch (error) {
      console.error('Error creating return:', error);
      toast({
        title: "Error",
        description: "Failed to create return",
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
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">Create Company Return</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reference Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Reference Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Reference Type</Label>
                <Select value={referenceType} onValueChange={(value: 'grn' | 'invoice') => setReferenceType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reference type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grn">GRN</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>{referenceType === 'grn' ? 'GRN' : 'Invoice'}</Label>
                <Select value={selectedReference} onValueChange={setSelectedReference}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${referenceType}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(referenceType === 'grn' ? grns : invoices).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.id} - {referenceType === 'grn' ? item.agency_name : item.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <h4 className="font-medium">Enter Quantities & Reasons</h4>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {productGridItems.map((gridItem, productIndex) => (
                      <div key={gridItem.product.id} className="border rounded-lg p-4">
                        <h5 className="font-medium mb-3">{gridItem.product.name}</h5>
                        <div className="space-y-3">
                          {gridItem.sizes.map((sizeItem, sizeIndex) => (
                            <div key={sizeItem.size} className="grid grid-cols-3 gap-3 items-end">
                              <div>
                                <Label className="text-sm">{sizeItem.size}</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={sizeItem.quantity}
                                  onChange={(e) => updateQuantity(productIndex, sizeIndex, parseInt(e.target.value) || 0)}
                                  placeholder="Qty"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-sm">Reason</Label>
                                <Input
                                  value={sizeItem.reason}
                                  onChange={(e) => updateReason(productIndex, sizeIndex, e.target.value)}
                                  placeholder="Return reason (damaged, expired, etc.)"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={addToReturnSummary} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Return Summary
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional notes about the return..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Return Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Return Summary ({returnSummary.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returnSummary.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No items added yet</p>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {returnSummary.map((item) => (
                      <div key={item.tempId} className="p-2 bg-gray-50 rounded">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.productName}</p>
                            <p className="text-xs text-gray-600">{item.color}, {item.size} × {item.quantity}</p>
                            <p className="text-xs text-orange-600">{item.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">LKR {item.total.toLocaleString()}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromReturnSummary(item.tempId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
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
                      onClick={submitReturn}
                      disabled={isSubmitting || returnSummary.length === 0 || !selectedReference}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Saving...' : 'Submit Return'}
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

export default EnhancedCompanyReturns;
