import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { externalInventoryService, ExternalInventoryItem } from '@/services/external-inventory.service';

interface SimpleBulkStockAdjustmentProps {
  user: User;
  onClose: () => void;
  onSubmitted: () => void;
  selectedAgencyId?: string; // For superusers to view other agencies
}

interface CategoryProduct {
  product_name: string;
  product_description: string; // Store the description for inventory matching
  product_code?: string;
  color: string;
  size: string;
  category: string;
  current_stock: number;
  actual_stock: number; // What user enters
  variation: number; // Calculated difference
  unit_price: number;
}

interface CategoryData {
  name: string;
  products: CategoryProduct[];
}

const SimpleBulkStockAdjustment = ({ user, onClose, onSubmitted, selectedAgencyId }: SimpleBulkStockAdjustmentProps) => {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batchName, setBatchName] = useState(`Stock Count ${new Date().toLocaleDateString()}`);
  const { toast } = useToast();

  // Use selectedAgencyId if provided (for superusers), otherwise use user's agency
  const agencyId = selectedAgencyId || user.agencyId;

  useEffect(() => {
    fetchInventoryData();
  }, [agencyId]);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      
      // Get all products from products table as source of truth
      console.log('🔍 Fetching all products from products table...');
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('name, description, sub_category')
        .order('name');

      if (productsError) {
        throw productsError;
      }

      console.log(`📦 Found ${allProducts?.length || 0} products in products table`);

      // Get current stock levels from external inventory system
      console.log('🔍 Fetching current inventory data...');
      const inventoryItems = await externalInventoryService.getStockSummary(user.id);
      
      console.log(`📦 Found ${inventoryItems.length} inventory items with current stock`);

      // Convert all products to CategoryProduct format
      const allProductsMap = new Map<string, CategoryProduct>();
      
      // Use products table as single source of truth and aggregate inventory data
      allProducts?.forEach(product => {
        // Find all inventory items that match this product description
        const matchingInventoryItems = inventoryItems.filter(item => 
          item.original_product_name === product.description
        );
        
        // Calculate total current stock across all variants
        const totalCurrentStock = matchingInventoryItems.reduce((sum, item) => sum + item.current_stock, 0);
        
        // Get average unit price
        const averageUnitPrice = matchingInventoryItems.length > 0 
          ? matchingInventoryItems.reduce((sum, item) => sum + (item.avg_unit_price || 0), 0) / matchingInventoryItems.length
          : 0;
        
        // Get first matching inventory item for additional details
        const firstInventoryItem = matchingInventoryItems[0];
        
        // Create single entry per product from products table
        const key = product.description;
        
        allProductsMap.set(key, {
          product_name: product.name, // Use display name from products table
          product_description: product.description, // Store description for inventory matching
          product_code: firstInventoryItem?.product_code || undefined,
          color: 'All Variants', // Indicate this is aggregated across variants
          size: 'All Sizes', // Indicate this is aggregated across sizes
          category: product.sub_category || 'General', // Use sub_category from products table
          current_stock: totalCurrentStock, // Aggregated stock from all variants
          actual_stock: totalCurrentStock, // Default to current stock
          variation: 0, // Will be calculated when user changes actual_stock
          unit_price: averageUnitPrice
        });
        
        console.log(`📊 Product: ${product.name} (${product.description}), Total Stock: ${totalCurrentStock}, Variants: ${matchingInventoryItems.length}`);
      });

      console.log(`📊 Processed ${allProductsMap.size} unique products`);

      // Group products by category
      const categoryGroups: { [key: string]: CategoryProduct[] } = {};
      allProductsMap.forEach(product => {
        const categoryName = product.category || 'General';
        if (!categoryGroups[categoryName]) {
          categoryGroups[categoryName] = [];
        }
        categoryGroups[categoryName].push(product);
      });

      // Convert to CategoryData format
      const categoryData: CategoryData[] = Object.entries(categoryGroups).map(([name, products]) => ({
        name,
        products: products.sort((a, b) => a.product_name.localeCompare(b.product_name))
      }));

      console.log(`📊 Organized into ${categoryData.length} categories`);
      setCategories(categoryData.sort((a, b) => a.name.localeCompare(b.name)));
      
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateActualStock = (categoryIndex: number, productIndex: number, actualStock: number) => {
    setCategories(prev => {
      const updated = [...prev];
      const product = updated[categoryIndex].products[productIndex];
      product.actual_stock = actualStock;
      product.variation = actualStock - product.current_stock;
      return updated;
    });
  };


  const submitAllAdjustments = async () => {
    try {
      setSubmitting(true);
      const batchId = crypto.randomUUID();

      // Collect all adjustments from all categories
      const allAdjustments: any[] = [];
      
      // Use the external inventory service method for each adjustment
      for (const category of categories) {
        for (const product of category.products) {
          if (product.variation !== 0) { // Only include items with changes
            try {
              console.log(`🔍 Adjusting aggregated product: ${product.product_description}, variation: ${product.variation}`);

              // Submit stock adjustment directly to external_inventory_management with pending status
              const { error } = await supabase
                .from('external_inventory_management')
                .insert({
                  product_name: product.product_description,
                  color: 'Default', // Use Default for aggregated adjustments
                  size: 'Default', // Use Default for aggregated adjustments
                  category: 'General',
                  sub_category: product.category,
                  transaction_type: 'adjustment',
                  transaction_id: `STOCK-COUNT-${batchId}-${Date.now()}`,
                  quantity: product.variation, // The adjustment amount (+ or -)
                  reference_name: user.name, // User who submitted the stock count
                  agency_id: agencyId,
                  user_name: user.name || 'Unknown User',
                  notes: `Stock Count Batch: ${batchName}. Product: ${product.product_name}. Adjustment - Current: ${product.current_stock}, Target: ${product.actual_stock}, Variation: ${product.variation}`,
                  external_source: 'stock_count',
                  approval_status: 'pending', // Pending approval
                  requested_by: user.id,
                  requested_by_name: user.name || 'Unknown User'
                });

              if (error) {
                console.error(`Failed to add adjustment for ${product.product_name}:`, error);
                throw error;
              }

              console.log(`✅ Added aggregated stock adjustment: ${product.product_name}, variation: ${product.variation}, reference_name: ${user.name}`);
              
              allAdjustments.push({
                product_name: product.product_name,
                variation: product.variation,
                category: category.name
              });
            } catch (error) {
              console.error(`Failed to add adjustment for ${product.product_name}:`, error);
              throw error;
            }
          }
        }
      }

      if (allAdjustments.length === 0) {
        toast({
          title: "No Changes",
          description: "No stock variations found to submit",
          variant: "destructive"
        });
        return;
      }

      console.log('📋 Successfully processed adjustments:', allAdjustments);

      toast({
        title: "Stock Count Submitted for Approval",
        description: `Successfully submitted ${allAdjustments.length} stock adjustments for superuser approval`,
      });

      // Force refresh inventory data after adjustments
      console.log('🔄 Forcing inventory refresh after stock count submission');
      
      onSubmitted();
      onClose();

    } catch (error: any) {
      console.error('Error submitting stock count:', error);
      
      let errorMessage = "Failed to submit stock count";
      if (error.message) {
        errorMessage = error.message;
      }
      if (error.details) {
        errorMessage += ` - ${error.details}`;
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-semibold mb-4">No Inventory Found</h2>
          <p className="text-gray-600 mb-4">No inventory items found for stock counting.</p>
          <Button onClick={onClose} className="w-full">Close</Button>
        </div>
      </div>
    );
  }

  const totalVariations = categories.reduce((sum, cat) => 
    sum + cat.products.reduce((catSum, prod) => catSum + Math.abs(prod.variation), 0), 0
  );
  const totalProducts = categories.reduce((sum, cat) => sum + cat.products.length, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 touch-manipulation">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-full max-h-[98vh] overflow-hidden">
        {/* Header - Compact */}
        <div className="flex items-center justify-between p-2 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-base font-semibold">Stock Count - All Products</h2>
            <p className="text-xs text-gray-600">
              {totalProducts} products across {categories.length} categories
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs px-2 py-1">
              {totalVariations} Changes
            </Badge>
            <Button variant="ghost" onClick={onClose} className="p-1 touch-manipulation hover:bg-gray-100" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Batch Name - Compact */}
        <div className="p-2 border-b bg-gray-50">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Batch Name:
          </label>
          <Input
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="Enter batch name..."
            className="w-full text-sm touch-manipulation h-8"
          />
        </div>

        {/* All Products by Category - Compact */}
        <div className="p-2 overflow-y-auto max-h-[70vh]">
          <div className="space-y-2">
            {categories.map((category, categoryIndex) => (
              <div key={category.name} className="border rounded-lg">
                <div className="bg-gray-50 px-2 py-2 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{category.name}</h3>
                    <div className="text-xs text-gray-600">
                      {category.products.length} products
                    </div>
                  </div>
                </div>

                <div className="p-2 space-y-2">
                  {category.products.map((product, productIndex) => (
                    <div key={`${product.product_name}-${product.color}-${product.size}`} 
                         className="flex flex-col gap-2 p-2 border rounded-lg hover:bg-gray-50 touch-manipulation">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm truncate">{product.product_name}</h4>
                        <div className="flex flex-wrap gap-1 text-xs text-gray-600 mt-1">
                          {product.product_code && (
                            <span className="bg-gray-100 px-1 py-0.5 rounded text-xs">{product.product_code}</span>
                          )}
                          <span>{product.color}</span>
                          <span>•</span>
                          <span>{product.size}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-center flex-1">
                          <p className="text-xs text-gray-600">System</p>
                          <p className="text-sm font-semibold">{product.current_stock}</p>
                        </div>

                        <div className="text-center flex-1">
                          <p className="text-xs text-gray-600">Actual</p>
                          <Input
                            type="number"
                            value={product.actual_stock}
                            onChange={(e) => updateActualStock(categoryIndex, productIndex, parseInt(e.target.value) || 0)}
                            className="w-14 text-center text-sm font-semibold touch-manipulation h-8"
                            min="0"
                          />
                        </div>

                        <div className="text-center flex-1">
                          <p className="text-xs text-gray-600">Change</p>
                          <p className={`text-sm font-semibold ${
                            product.variation > 0 ? 'text-green-600' : 
                            product.variation < 0 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {product.variation > 0 ? '+' : ''}{product.variation}
                          </p>
                        </div>

                        {product.variation !== 0 && (
                          <div className="flex-shrink-0">
                            <Badge variant={product.variation > 0 ? "default" : "destructive"} className="text-xs">
                              {product.variation > 0 ? "+" : "-"}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer - Compact */}
        <div className="flex items-center justify-between p-2 border-t bg-gray-50">
          <div className="text-xs text-gray-600">
            Review and submit when ready
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={submitAllAdjustments}
              disabled={submitting || totalVariations === 0}
              className="bg-blue-600 hover:bg-blue-700 touch-manipulation h-8 text-xs px-3"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Submit ({totalVariations})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleBulkStockAdjustment;