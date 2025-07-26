import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useOdoo } from '@/hooks/useOdoo';
import { supabase } from '@/integrations/supabase/client';

interface SyncResult {
  success: boolean;
  message: string;
  products_synced: number;
  inventory_items_created: number;
  errors: string[];
}

interface InventorySyncButtonProps {
  user: any;
  onSyncComplete?: () => void;
}

export const InventorySyncButton: React.FC<InventorySyncButtonProps> = ({ 
  user, 
  onSyncComplete 
}) => {
  const { isAuthenticated, isLoading: authLoading } = useOdoo();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
      const odooProducts = await odooService.getProducts(100);
      
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
      <Button 
        onClick={syncOdooProductsToInventory}
        disabled={isSyncing}
        className="bg-green-600 hover:bg-green-700"
      >
        {isSyncing ? (
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

      {/* Sync Results */}
      {syncResult && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {syncResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
              Sync Results
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Status:</span>
                <Badge variant={syncResult.success ? "default" : "secondary"} className="ml-2">
                  {syncResult.success ? "Success" : "Partial"}
                </Badge>
              </div>
              <div>
                <span className="text-gray-600">Products:</span>
                <span className="ml-2 font-medium">{syncResult.products_synced}</span>
              </div>
              <div>
                <span className="text-gray-600">Inventory Items:</span>
                <span className="ml-2 font-medium">{syncResult.inventory_items_created}</span>
              </div>
              <div>
                <span className="text-gray-600">Errors:</span>
                <span className="ml-2 font-medium">{syncResult.errors.length}</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mt-2">{syncResult.message}</p>

            {/* Error Details */}
            {syncResult.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-700 mb-2 text-sm">Error Details:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {syncResult.errors.slice(0, 5).map((err, index) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {err}
                    </div>
                  ))}
                  {syncResult.errors.length > 5 && (
                    <div className="text-xs text-gray-500">
                      ... and {syncResult.errors.length - 5} more errors
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

export default InventorySyncButton; 