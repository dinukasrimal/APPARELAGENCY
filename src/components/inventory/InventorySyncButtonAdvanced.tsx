import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useOdoo } from '@/hooks/useOdoo';
import { useOdooEdgeFunction } from '@/hooks/useOdooEdgeFunction';
import { supabase } from '@/integrations/supabase/client';

interface SyncResult {
  success: boolean;
  message: string;
  products_synced: number;
  inventory_items_created: number;
  errors: string[];
}

interface SyncResponse {
  success: boolean;
  message: string;
  synced_count: number;
  error_count: number;
  errors: string[];
}

// Unified interface for display
interface UnifiedSyncResult {
  success: boolean;
  message: string;
  products_synced: number;
  inventory_items_created: number;
  error_count: number;
  errors: string[];
}

interface InventorySyncButtonAdvancedProps {
  user: any;
  onSyncComplete?: () => void;
}

export const InventorySyncButtonAdvanced: React.FC<InventorySyncButtonAdvancedProps> = ({ 
  user, 
  onSyncComplete 
}) => {
  const { isAuthenticated, isLoading: authLoading } = useOdoo();
  const { syncData: edgeSyncData, isSyncing: edgeIsSyncing, lastSyncResult: edgeSyncResult } = useOdooEdgeFunction();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [useEdgeFunction, setUseEdgeFunction] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [syncLimit, setSyncLimit] = useState(100);

  const syncOdooProductsToInventory = async () => {
    if (!isAuthenticated) {
      toast.error('Odoo authentication required. Please check your credentials.');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      // Import odooService dynamically to avoid TypeScript errors
      const { default: odooService } = await import('@/services/odoo.service');
      
      // Get products from Odoo
      const odooProducts = await odooService.getProducts(syncLimit);
      
      let productsSynced = 0;
      let inventoryItemsCreated = 0;
      const errors: string[] = [];

      for (const odooProduct of odooProducts) {
        try {
          // Check if product already exists in Supabase products table
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('name', odooProduct.name)
            .single();

          let productId: string;

          if (existingProduct) {
            productId = existingProduct.id;
            // Update existing product
            await supabase
              .from('products')
              .update({
                name: odooProduct.name,
                description: odooProduct.description || null,
                selling_price: odooProduct.list_price,
                billing_price: odooProduct.list_price,
                category: odooProduct.categ_id?.[1] || 'General',
                updated_at: new Date().toISOString()
              })
              .eq('id', productId);
          } else {
            // Create new product
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert({
                name: odooProduct.name,
                description: odooProduct.description || null,
                selling_price: odooProduct.list_price,
                billing_price: odooProduct.list_price,
                category: odooProduct.categ_id?.[1] || 'General',
                colors: ['Default'],
                sizes: ['Default'],
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (productError) {
              throw new Error(`Failed to create product: ${productError.message}`);
            }

            productId = newProduct.id;
          }

          // Check if inventory item already exists
          const { data: existingInventory } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('product_id', productId)
            .eq('color', 'Default')
            .eq('size', 'Default')
            .eq('agency_id', user.agencyId)
            .single();

          if (!existingInventory) {
            // Create inventory item
            const { error: inventoryError } = await supabase
              .from('inventory_items')
              .insert({
                product_id: productId,
                product_name: odooProduct.name,
                color: 'Default',
                size: 'Default',
                current_stock: 0, // Start with 0 stock
                agency_id: user.agencyId,
                last_updated: new Date().toISOString(),
                minimum_stock: 0,
                maximum_stock: 100
              });

            if (inventoryError) {
              throw new Error(`Failed to create inventory item: ${inventoryError.message}`);
            }

            inventoryItemsCreated++;
          }

          productsSynced++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Product ${odooProduct.name}: ${errorMessage}`);
        }
      }

      const result: SyncResult = {
        success: errors.length === 0,
        message: `Successfully synced ${productsSynced} products and created ${inventoryItemsCreated} inventory items${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        products_synced: productsSynced,
        inventory_items_created: inventoryItemsCreated,
        errors
      };

      setSyncResult(result);

      if (result.success) {
        toast.success(`Successfully synced ${productsSynced} products`);
        onSyncComplete?.();
      } else {
        toast.error(`Sync completed with ${errors.length} errors`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync products';
      toast.error(errorMessage);
      
      setSyncResult({
        success: false,
        message: errorMessage,
        products_synced: 0,
        inventory_items_created: 0,
        errors: [errorMessage]
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = async () => {
    if (useEdgeFunction) {
      // Use edge function approach
      await edgeSyncData({
        agencyId: user.agencyId,
        syncType: 'products',
        limit: syncLimit
      });
      onSyncComplete?.();
    } else {
      // Use frontend approach
      await syncOdooProductsToInventory();
    }
  };

  const isSyncingAny = isSyncing || edgeIsSyncing;
  
  // Convert results to unified format for display
  const getUnifiedResult = (): UnifiedSyncResult | null => {
    if (useEdgeFunction && edgeSyncResult) {
      return {
        success: edgeSyncResult.success,
        message: edgeSyncResult.message,
        products_synced: edgeSyncResult.synced_count,
        inventory_items_created: 0, // Edge function doesn't create inventory items
        error_count: edgeSyncResult.error_count,
        errors: edgeSyncResult.errors
      };
    } else if (!useEdgeFunction && syncResult) {
      return {
        success: syncResult.success,
        message: syncResult.message,
        products_synced: syncResult.products_synced,
        inventory_items_created: syncResult.inventory_items_created,
        error_count: syncResult.errors.length,
        errors: syncResult.errors
      };
    }
    return null;
  };

  const currentSyncResult = getUnifiedResult();

  if (authLoading) {
    return (
      <Button disabled className="bg-gray-400">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Initializing...
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button disabled variant="outline" className="text-red-600 border-red-600">
        <XCircle className="h-4 w-4 mr-2" />
        Odoo Not Connected
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Button 
          onClick={handleSync}
          disabled={isSyncingAny}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSyncingAny ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync from Odoo
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sync Settings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="edge-function"
                checked={useEdgeFunction}
                onCheckedChange={setUseEdgeFunction}
              />
              <Label htmlFor="edge-function">
                Use Edge Function {useEdgeFunction ? '(Recommended)' : '(Frontend)'}
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-limit">Sync Limit</Label>
              <Select value={syncLimit.toString()} onValueChange={(value) => setSyncLimit(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 products</SelectItem>
                  <SelectItem value="100">100 products</SelectItem>
                  <SelectItem value="200">200 products</SelectItem>
                  <SelectItem value="500">500 products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Frontend Sync:</strong> Direct browser-to-Odoo communication</p>
              <p><strong>Edge Function:</strong> Server-side processing (more secure, handles large datasets)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Results */}
      {currentSyncResult && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {currentSyncResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              Sync Results ({useEdgeFunction ? 'Edge Function' : 'Frontend'})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Status:</span>
                <Badge variant={currentSyncResult.success ? "default" : "secondary"} className="ml-2">
                  {currentSyncResult.success ? "Success" : "Partial"}
                </Badge>
              </div>
              <div>
                <span className="text-gray-600">Products:</span>
                <span className="ml-2 font-medium">{currentSyncResult.products_synced}</span>
              </div>
              <div>
                <span className="text-gray-600">Inventory Items:</span>
                <span className="ml-2 font-medium">
                  {useEdgeFunction ? 'N/A' : currentSyncResult.inventory_items_created}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Errors:</span>
                <span className="ml-2 font-medium">{currentSyncResult.error_count}</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mt-2">{currentSyncResult.message}</p>

            {/* Error Details */}
            {currentSyncResult.error_count > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-700 mb-2 text-sm">Error Details:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {currentSyncResult.errors.slice(0, 5).map((err, index) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {err}
                    </div>
                  ))}
                  {currentSyncResult.errors.length > 5 && (
                    <div className="text-xs text-gray-500">
                      ... and {currentSyncResult.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InventorySyncButtonAdvanced; 