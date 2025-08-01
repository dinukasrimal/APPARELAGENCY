import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Upload, Download, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { externalInventoryService, ExternalInventoryItem } from '@/services/external-inventory.service';

interface ExternalBulkStockAdjustmentFormProps {
  user: User;
  onClose: () => void;
  onSubmitted: () => void;
}

interface AdjustmentItem {
  id: string;
  product_name: string;
  product_code?: string;
  color: string;
  size: string;
  category?: string;
  current_stock: number;
  adjustment_quantity: number;
  new_stock: number;
  reason: string;
  notes?: string;
  unit_price?: number;
}

const ExternalBulkStockAdjustmentForm = ({ user, onClose, onSubmitted }: ExternalBulkStockAdjustmentFormProps) => {
  const [inventoryItems, setInventoryItems] = useState<ExternalInventoryItem[]>([]);
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [batchName, setBatchName] = useState('');
  const [defaultReason, setDefaultReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'manual' | 'bulk' | 'correction' | 'damage' | 'loss' | 'found'>('bulk');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchInventoryItems();
  }, [user.agencyId]);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const items = await externalInventoryService.getStockSummary(user.agencyId);
      setInventoryItems(items);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addAdjustmentItem = (inventoryItem: ExternalInventoryItem) => {
    const existingIndex = adjustmentItems.findIndex(
      item => item.product_name === inventoryItem.product_name && 
               item.color === inventoryItem.color && 
               item.size === inventoryItem.size
    );

    if (existingIndex >= 0) {
      toast({
        title: "Item Already Added",
        description: "This item is already in the adjustment list",
        variant: "destructive"
      });
      return;
    }

    const newItem: AdjustmentItem = {
      id: `${inventoryItem.product_name}-${inventoryItem.color}-${inventoryItem.size}-${Date.now()}`,
      product_name: inventoryItem.product_name,
      product_code: inventoryItem.product_code || undefined,
      color: inventoryItem.color,
      size: inventoryItem.size,
      category: inventoryItem.category || undefined,
      current_stock: inventoryItem.current_stock,
      adjustment_quantity: 0,
      new_stock: inventoryItem.current_stock,
      reason: defaultReason,
      unit_price: inventoryItem.avg_unit_price || 0
    };

    setAdjustmentItems([...adjustmentItems, newItem]);
  };

  const removeAdjustmentItem = (id: string) => {
    setAdjustmentItems(adjustmentItems.filter(item => item.id !== id));
  };

  const updateAdjustmentItem = (id: string, field: keyof AdjustmentItem, value: any) => {
    setAdjustmentItems(adjustmentItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate new_stock when adjustment_quantity changes
        if (field === 'adjustment_quantity') {
          updatedItem.new_stock = updatedItem.current_stock + Number(value);
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const applyDefaultReason = () => {
    if (!defaultReason.trim()) {
      toast({
        title: "No Default Reason",
        description: "Please enter a default reason first",
        variant: "destructive"
      });
      return;
    }

    setAdjustmentItems(adjustmentItems.map(item => ({
      ...item,
      reason: defaultReason
    })));

    toast({
      title: "Default Reason Applied",
      description: `Applied "${defaultReason}" to all ${adjustmentItems.length} items`,
    });
  };

  const validateForm = (): boolean => {
    if (!batchName.trim()) {
      toast({
        title: "Batch Name Required",
        description: "Please enter a batch name for this adjustment",
        variant: "destructive"
      });
      return false;
    }

    if (adjustmentItems.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please add at least one item to adjust",
        variant: "destructive"
      });
      return false;
    }

    const invalidItems = adjustmentItems.filter(item => 
      !item.reason.trim() || item.adjustment_quantity === 0
    );

    if (invalidItems.length > 0) {
      toast({
        title: "Invalid Items",
        description: `${invalidItems.length} items have missing reason or zero adjustment quantity`,
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const submitAdjustments = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const batchId = crypto.randomUUID();

      // Prepare adjustment records
      const adjustmentRecords = adjustmentItems.map(item => ({
        product_name: item.product_name,
        product_code: item.product_code,
        color: item.color,
        size: item.size,
        category: item.category,
        current_stock: item.current_stock,
        adjustment_quantity: item.adjustment_quantity,
        new_stock: item.new_stock,
        unit_price: item.unit_price || 0,
        reason: item.reason,
        notes: item.notes,
        adjustment_type: adjustmentType,
        agency_id: user.agencyId,
        requested_by: user.id,
        requested_by_name: user.name,
        batch_id: batchId,
        batch_name: batchName,
        external_source: 'bulk_form'
      }));

      // Insert all adjustments
      const { error } = await supabase
        .from('external_stock_adjustments')
        .insert(adjustmentRecords);

      if (error) {
        throw error;
      }

      toast({
        title: "Bulk Adjustment Submitted",
        description: `Successfully submitted ${adjustmentItems.length} stock adjustments for approval`,
      });

      onSubmitted();
      onClose();

    } catch (error: any) {
      console.error('Error submitting bulk adjustments:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit bulk adjustments",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventoryItems = inventoryItems.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.product_code && item.product_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalAdjustmentValue = adjustmentItems.reduce((sum, item) => 
    sum + (item.adjustment_quantity * (item.unit_price || 0)), 0
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Bulk Stock Adjustment</h2>
            <p className="text-sm text-gray-600">Submit multiple stock adjustments for approval</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="p-2">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Left Panel - Available Items */}
          <div className="w-1/2 border-r p-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Available Items</h3>
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading inventory items...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredInventoryItems.map((item, index) => (
                    <div key={`${item.product_name}-${item.color}-${item.size}-${index}`} 
                         className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-gray-600 flex gap-2">
                          {item.product_code && (
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">{item.product_code}</span>
                          )}
                          <span>{item.color}</span>
                          <span>•</span>
                          <span>{item.size}</span>
                          <span>•</span>
                          <span className="font-medium">Stock: {item.current_stock}</span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => addAdjustmentItem(item)}
                        className="ml-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Adjustment Form */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <div className="space-y-4">
              {/* Batch Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Batch Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Batch Name</label>
                    <Input
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g., Monthly Stock Count - January 2025"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Adjustment Type</label>
                    <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bulk">Bulk Adjustment</SelectItem>
                        <SelectItem value="correction">Stock Correction</SelectItem>
                        <SelectItem value="damage">Damage/Defect</SelectItem>
                        <SelectItem value="loss">Stock Loss</SelectItem>
                        <SelectItem value="found">Stock Found</SelectItem>
                        <SelectItem value="manual">Manual Count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Default Reason</label>
                    <div className="flex gap-2">
                      <Input
                        value={defaultReason}
                        onChange={(e) => setDefaultReason(e.target.value)}
                        placeholder="Enter default reason for all items"
                      />
                      <Button 
                        variant="outline" 
                        onClick={applyDefaultReason}
                        disabled={adjustmentItems.length === 0}
                      >
                        Apply to All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Adjustment Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Adjustment Items ({adjustmentItems.length})
                    {adjustmentItems.length > 0 && (
                      <Badge variant="outline">
                        Total Value: LKR {totalAdjustmentValue.toLocaleString()}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {adjustmentItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No items selected for adjustment</p>
                      <p className="text-sm">Add items from the left panel</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {adjustmentItems.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-sm text-gray-600 flex gap-2">
                                {item.product_code && (
                                  <span className="bg-gray-100 px-2 py-1 rounded text-xs">{item.product_code}</span>
                                )}
                                <span>{item.color}</span>
                                <span>•</span>
                                <span>{item.size}</span>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeAdjustmentItem(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Current Stock</label>
                              <Input value={item.current_stock} disabled className="text-center" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Adjustment</label>
                              <Input
                                type="number"
                                value={item.adjustment_quantity}
                                onChange={(e) => updateAdjustmentItem(item.id, 'adjustment_quantity', Number(e.target.value))}
                                className="text-center"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">New Stock</label>
                              <Input 
                                value={item.new_stock} 
                                disabled 
                                className={`text-center ${
                                  item.new_stock < 0 ? 'text-red-600' : 
                                  item.adjustment_quantity > 0 ? 'text-green-600' : 
                                  item.adjustment_quantity < 0 ? 'text-red-600' : ''
                                }`} 
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                              <Input
                                value={item.reason}
                                onChange={(e) => updateAdjustmentItem(item.id, 'reason', e.target.value)}
                                placeholder="Reason for adjustment"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (Optional)</label>
                              <Textarea
                                value={item.notes || ''}
                                onChange={(e) => updateAdjustmentItem(item.id, 'notes', e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {adjustmentItems.length} items selected for adjustment
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={submitAdjustments} 
              disabled={submitting || adjustmentItems.length === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Submit for Approval
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExternalBulkStockAdjustmentForm;