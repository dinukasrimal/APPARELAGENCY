import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Minus, Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  subCategory: string;
  color: string;
  size: string;
  currentStock: number;
  minStockLevel: number;
  unitPrice: number;
  agencyId: string;
  lastUpdated: Date;
}

interface AdjustmentReason {
  id: number;
  reason: string;
  description: string;
}

interface StockAdjustmentFormProps {
  user: User;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSubmitted: () => void;
}

const StockAdjustmentForm = ({ user, inventoryItems, onClose, onSubmitted }: StockAdjustmentFormProps) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [adjustmentReasons, setAdjustmentReasons] = useState<AdjustmentReason[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch adjustment reasons
  useEffect(() => {
    const fetchReasons = async () => {
      const { data, error } = await supabase
        .from('stock_adjustment_reasons')
        .select('id, reason, description')
        .eq('is_active', true)
        .order('reason');

      if (error) {
        console.error('Error fetching adjustment reasons:', error);
      } else {
        setAdjustmentReasons(data || []);
      }
    };

    fetchReasons();
  }, []);

  // Filter inventory items based on search
  const filteredItems = inventoryItems.filter(item =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.subCategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedItem || !quantity || !reason || !justification.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const adjustmentQty = parseInt(quantity);
    if (isNaN(adjustmentQty) || adjustmentQty <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid positive number",
        variant: "destructive"
      });
      return;
    }

    if (adjustmentType === 'decrease' && adjustmentQty > selectedItem.currentStock) {
      toast({
        title: "Invalid Decrease",
        description: "Cannot decrease stock below zero",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newStock = adjustmentType === 'increase' 
        ? selectedItem.currentStock + adjustmentQty
        : selectedItem.currentStock - adjustmentQty;

      const { error } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: selectedItem.productId,
          product_name: selectedItem.productName,
          color: selectedItem.color,
          size: selectedItem.size,
          adjustment_type: adjustmentType,
          quantity: adjustmentQty,
          current_stock: selectedItem.currentStock,
          new_stock: newStock,
          reason: reason,
          justification: justification,
          requested_by: user.id,
          agency_id: user.agencyId
        });

      if (error) {
        console.error('Error submitting adjustment:', error);
        toast({
          title: "Submission Failed",
          description: "Failed to submit stock adjustment request",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Request Submitted",
          description: "Stock adjustment request submitted for approval",
          variant: "default"
        });
        onSubmitted();
        onClose();
      }
    } catch (error) {
      console.error('Error submitting adjustment:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const newStockLevel = selectedItem && quantity ? 
    (adjustmentType === 'increase' 
      ? selectedItem.currentStock + parseInt(quantity || '0')
      : selectedItem.currentStock - parseInt(quantity || '0')
    ) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Adjustment Request
          </CardTitle>
          <p className="text-sm text-gray-600">
            Submit a stock adjustment request for approval by a superuser
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <div className="space-y-3">
              <Label htmlFor="search">Select Product</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search for product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {searchTerm && (
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No products found matching your search
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setSearchTerm('');
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedItem?.id === item.id
                              ? 'bg-blue-50 border-blue-200'
                              : 'hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-gray-600">
                            {item.color} • {item.size} • {item.subCategory}
                          </div>
                          <div className="text-sm">
                            Current Stock: <span className="font-medium">{item.currentStock}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedItem && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{selectedItem.productName}</h4>
                        <p className="text-sm text-gray-600">
                          {selectedItem.color} • {selectedItem.size} • {selectedItem.subCategory}
                        </p>
                        <p className="text-sm">
                          Current Stock: <span className="font-medium">{selectedItem.currentStock}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItem(null)}
                      >
                        Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedItem && (
              <>
                {/* Adjustment Type */}
                <div className="space-y-3">
                  <Label>Adjustment Type</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('increase')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        adjustmentType === 'increase'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      Increase Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('decrease')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        adjustmentType === 'decrease'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Minus className="h-4 w-4" />
                      Decrease Stock
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-3">
                  <Label htmlFor="quantity">
                    Quantity to {adjustmentType === 'increase' ? 'Add' : 'Remove'}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={adjustmentType === 'decrease' ? selectedItem.currentStock : undefined}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    required
                  />
                  {quantity && !isNaN(parseInt(quantity)) && (
                    <div className="text-sm">
                      New stock level will be: 
                      <Badge variant={newStockLevel >= 0 ? 'default' : 'destructive'} className="ml-2">
                        {newStockLevel}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div className="space-y-3">
                  <Label htmlFor="reason">Reason for Adjustment</Label>
                  <Select value={reason} onValueChange={setReason} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {adjustmentReasons.map((reasonItem) => (
                        <SelectItem key={reasonItem.id} value={reasonItem.reason}>
                          {reasonItem.reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Justification */}
                <div className="space-y-3">
                  <Label htmlFor="justification">Detailed Justification</Label>
                  <Textarea
                    id="justification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Provide detailed explanation for this adjustment..."
                    rows={4}
                    required
                  />
                </div>

                {/* Warning for decreases */}
                {adjustmentType === 'decrease' && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Stock Decrease Request</p>
                      <p className="text-yellow-700">
                        This request will reduce inventory levels. Ensure the justification is clear 
                        and accurate as this action cannot be easily reversed.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!selectedItem || !quantity || !reason || !justification.trim() || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockAdjustmentForm;