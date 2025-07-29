import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Package, ArrowUp, ArrowDown, Save, X } from 'lucide-react';
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

interface AdjustmentItem {
  inventoryItem: InventoryItem;
  realStock: number | null;
  variation: number;
  adjustmentType: 'increase' | 'decrease' | 'none';
}

interface BulkStockAdjustmentFormProps {
  user: User;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSubmitted: () => void;
}

const BulkStockAdjustmentForm = ({ user, inventoryItems, onClose, onSubmitted }: BulkStockAdjustmentFormProps) => {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [reason, setReason] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [adjustmentReasons, setAdjustmentReasons] = useState<AdjustmentReason[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Get unique subcategories from inventory items
  const availableSubcategories = [...new Set(inventoryItems
    .map(item => item.subCategory)
    .filter(subcategory => subcategory && subcategory.trim() !== '')
  )].sort();

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

  // When subcategory is selected, populate adjustment items
  useEffect(() => {
    if (selectedSubcategory) {
      const itemsInSubcategory = inventoryItems.filter(
        item => item.subCategory === selectedSubcategory
      );

      const newAdjustmentItems: AdjustmentItem[] = itemsInSubcategory.map(item => ({
        inventoryItem: item,
        realStock: null,
        variation: 0,
        adjustmentType: 'none'
      }));

      setAdjustmentItems(newAdjustmentItems);
    } else {
      setAdjustmentItems([]);
    }
  }, [selectedSubcategory, inventoryItems]);

  const handleRealStockChange = (index: number, value: string) => {
    const realStock = value === '' ? null : parseInt(value);
    
    setAdjustmentItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      
      if (realStock === null) {
        item.realStock = null;
        item.variation = 0;
        item.adjustmentType = 'none';
      } else {
        item.realStock = realStock;
        item.variation = realStock - item.inventoryItem.currentStock;
        
        if (item.variation > 0) {
          item.adjustmentType = 'increase';
        } else if (item.variation < 0) {
          item.adjustmentType = 'decrease';
        } else {
          item.adjustmentType = 'none';
        }
      }
      
      return updated;
    });
  };

  const getVariationBadge = (variation: number, adjustmentType: string) => {
    if (adjustmentType === 'none' || variation === 0) {
      return <Badge variant="secondary">No Change</Badge>;
    }
    
    if (adjustmentType === 'increase') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <ArrowUp className="h-3 w-3 mr-1" />
          +{variation}
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-red-100 text-red-800">
        <ArrowDown className="h-3 w-3 mr-1" />
        {variation}
      </Badge>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get items that have adjustments
    const itemsWithAdjustments = adjustmentItems.filter(
      item => item.adjustmentType !== 'none' && item.variation !== 0
    );

    if (itemsWithAdjustments.length === 0) {
      toast({
        title: "No Adjustments",
        description: "Please enter real stock values that differ from current stock",
        variant: "destructive"
      });
      return;
    }

    if (!reason || !justification.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a reason and justification for the adjustments",
        variant: "destructive"
      });
      return;
    }

    // Check for invalid stock entries
    const invalidItems = itemsWithAdjustments.filter(
      item => item.realStock === null || item.realStock < 0
    );

    if (invalidItems.length > 0) {
      toast({
        title: "Invalid Stock Values",
        description: "Real stock values cannot be negative",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create bulk adjustment requests
      const adjustmentRequests = itemsWithAdjustments.map(item => ({
        product_id: item.inventoryItem.productId,
        product_name: item.inventoryItem.productName,
        color: item.inventoryItem.color,
        size: item.inventoryItem.size,
        adjustment_type: item.adjustmentType,
        quantity: Math.abs(item.variation),
        current_stock: item.inventoryItem.currentStock,
        new_stock: item.realStock!,
        reason: reason,
        justification: `${justification} (Bulk adjustment for ${selectedSubcategory})`,
        requested_by: user.id,
        agency_id: user.agencyId
      }));

      const { error } = await supabase
        .from('stock_adjustments')
        .insert(adjustmentRequests);

      if (error) {
        console.error('Error submitting bulk adjustments:', error);
        toast({
          title: "Submission Failed",
          description: "Failed to submit bulk stock adjustment requests",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Bulk Request Submitted",
          description: `${adjustmentRequests.length} stock adjustment requests submitted for approval`,
          variant: "default"
        });
        onSubmitted();
        onClose();
      }
    } catch (error) {
      console.error('Error submitting bulk adjustments:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAdjustments = adjustmentItems.filter(
    item => item.adjustmentType !== 'none' && item.variation !== 0
  ).length;

  const increasesCount = adjustmentItems.filter(
    item => item.adjustmentType === 'increase'
  ).length;

  const decreasesCount = adjustmentItems.filter(
    item => item.adjustmentType === 'decrease'
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-7xl max-h-[95vh] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bulk Stock Adjustment Request
          </CardTitle>
          <p className="text-sm text-gray-600">
            Select a subcategory and enter real stock counts to generate adjustment requests
          </p>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(95vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Subcategory Selection */}
            <div className="space-y-3">
              <Label htmlFor="subcategory">Select Subcategory</Label>
              <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subcategory to adjust" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory} value={subcategory}>
                      {subcategory}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Adjustment Summary */}
            {selectedSubcategory && adjustmentItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-blue-600">Total Items</p>
                    <p className="text-2xl font-bold text-blue-700">{adjustmentItems.length}</p>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-orange-600">Adjustments</p>
                    <p className="text-2xl font-bold text-orange-700">{totalAdjustments}</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-green-600">Increases</p>
                    <p className="text-2xl font-bold text-green-700">{increasesCount}</p>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-red-600">Decreases</p>
                    <p className="text-2xl font-bold text-red-700">{decreasesCount}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Stock Adjustment Table */}
            {selectedSubcategory && adjustmentItems.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Stock Adjustment for {selectedSubcategory}
                </h3>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Product</TableHead>
                        <TableHead>Color • Size</TableHead>
                        <TableHead className="text-center">Current Stock</TableHead>
                        <TableHead className="text-center">Real Stock</TableHead>
                        <TableHead className="text-center">Variation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustmentItems.map((item, index) => (
                        <TableRow key={item.inventoryItem.id}>
                          <TableCell className="font-medium">
                            {item.inventoryItem.productName}
                          </TableCell>
                          <TableCell>
                            {item.inventoryItem.color} • {item.inventoryItem.size}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono">
                              {item.inventoryItem.currentStock}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0"
                              value={item.realStock === null ? '' : item.realStock}
                              onChange={(e) => handleRealStockChange(index, e.target.value)}
                              className="w-20 text-center font-mono"
                              placeholder="Enter"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {getVariationBadge(item.variation, item.adjustmentType)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Reason and Justification */}
            {selectedSubcategory && adjustmentItems.length > 0 && (
              <>
                <div className="space-y-3">
                  <Label htmlFor="reason">Reason for Adjustments</Label>
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

                <div className="space-y-3">
                  <Label htmlFor="justification">Detailed Justification</Label>
                  <Textarea
                    id="justification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Provide detailed explanation for these bulk adjustments..."
                    rows={4}
                    required
                  />
                </div>

                {/* Warning for bulk adjustments */}
                {totalAdjustments > 0 && (
                  <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Bulk Stock Adjustment Request</p>
                      <p className="text-yellow-700">
                        You are requesting {totalAdjustments} stock adjustments ({increasesCount} increases, {decreasesCount} decreases) 
                        for the {selectedSubcategory} subcategory. All adjustments will be sent for superuser approval.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!selectedSubcategory || totalAdjustments === 0 || !reason || !justification.trim() || isSubmitting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : `Submit ${totalAdjustments} Adjustments`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkStockAdjustmentForm;