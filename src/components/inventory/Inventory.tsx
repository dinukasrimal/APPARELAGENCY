import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Search, AlertTriangle, TrendingDown, Plus, ExternalLink, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { externalInventoryService } from '@/services/external-inventory.service';
import { useToast } from '@/hooks/use-toast';
import InventorySyncButton from './InventorySyncButton';
import InventoryCategorySidebar from './InventoryCategorySidebar';
import StockAdjustmentForm from './StockAdjustmentForm';
import StockAdjustmentApproval from './StockAdjustmentApproval';
import StockAdjustmentHistory from './StockAdjustmentHistory';
import BulkStockAdjustmentForm from './BulkStockAdjustmentForm';

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

interface StockMovement {
  id: string;
  productName: string;
  color: string;
  size: string;
  transactionType: string;
  quantity: number;
  referenceName: string;
  createdAt: string;
  externalProductName?: string;
  externalProductCategory?: string;
}

interface StockSummary {
  productName: string;
  color: string;
  size: string;
  category: string;
  currentStock: number;
  stockIn: number; // From external invoices
  stockOut: number; // From internal invoices
  balance: number;
}

interface InventoryProps {
  user: User;
}

const Inventory = ({ user }: InventoryProps) => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [showBulkAdjustmentForm, setShowBulkAdjustmentForm] = useState(false);
  const [showApprovalInterface, setShowApprovalInterface] = useState(false);
  const [showAdjustmentHistory, setShowAdjustmentHistory] = useState(false);
  const { toast } = useToast();

  // Filter items based on user role and filters
  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.size.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.subCategory === categoryFilter;
    
    let matchesStockFilter = true;
    if (stockFilter === 'low') {
      matchesStockFilter = item.currentStock <= item.minStockLevel;
    } else if (stockFilter === 'out') {
      matchesStockFilter = item.currentStock === 0;
    }
    
    return matchesSearch && matchesCategory && matchesStockFilter;
  });

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock === 0) {
      return { status: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (item.currentStock <= item.minStockLevel) {
      return { status: 'Low Stock', variant: 'secondary' as const, icon: TrendingDown };
    } else {
      return { status: 'In Stock', variant: 'default' as const, icon: Package };
    }
  };

  // Get unique subcategories dynamically from inventory items
  const availableCategories = [...new Set(inventoryItems
    .map(item => item.subCategory)
    .filter(category => category && category.trim() !== '')
  )].sort();

  const totalValue = filteredItems.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);
  const lowStockItems = filteredItems.filter(item => item.currentStock <= item.minStockLevel).length;
  const outOfStockItems = filteredItems.filter(item => item.currentStock === 0).length;

  // Fetch inventory data
  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      
      // Fetch current inventory items
      let inventoryQuery = supabase
        .from('inventory_items')
        .select(`
          id,
          product_id,
          product_name,
          color,
          size,
          current_stock,
          minimum_stock,
          agency_id,
          last_updated
        `);

      // Apply role-based filtering
      if (user.role === 'agent' || user.role === 'agency') {
        inventoryQuery = inventoryQuery.eq('agency_id', user.agencyId);
      }

      const { data: inventoryData, error: inventoryError } = await inventoryQuery;
      
      if (inventoryError) {
        console.error('Error fetching inventory items:', inventoryError);
        toast({
          title: "Error",
          description: "Failed to fetch inventory data",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Get product details separately to avoid foreign key issues
      const productIds = [...new Set((inventoryData || []).map(item => item.product_id).filter(Boolean))];
      let productDetails = new Map();
      
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, category, sub_category, selling_price')
          .in('id', productIds);
        
        if (productsData) {
          productsData.forEach(product => {
            productDetails.set(product.id, product);
          });
        }
      }

      // Transform data
      const transformedItems: InventoryItem[] = (inventoryData || []).map(item => {
        const product = productDetails.get(item.product_id);
        return {
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          category: product?.category || 'Unknown',
          subCategory: product?.sub_category || '',
          color: item.color,
          size: item.size,
          currentStock: item.current_stock,
          minStockLevel: item.minimum_stock || 0,
          unitPrice: product?.selling_price || 0,
          agencyId: item.agency_id,
          lastUpdated: new Date(item.last_updated)
        };
      });

      setInventoryItems(transformedItems);
      
      // Fetch recent stock movements
      await fetchStockMovements();
      
      // Calculate stock summary with external vs internal breakdown
      await calculateStockSummary();
      
    } catch (error) {
      console.error('Error in fetchInventoryData:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent stock movements
  const fetchStockMovements = async () => {
    try {
      let movementsQuery = supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (user.role === 'agent' || user.role === 'agency') {
        movementsQuery = movementsQuery.eq('agency_id', user.agencyId);
      }

      const { data: movementsData, error: movementsError } = await movementsQuery;
      
      if (movementsError) {
        console.error('Error fetching stock movements:', movementsError);
        return;
      }

      const movements: StockMovement[] = (movementsData || []).map(movement => ({
        id: movement.id,
        productName: movement.product_name,
        color: movement.color,
        size: movement.size,
        transactionType: movement.transaction_type,
        quantity: movement.quantity,
        referenceName: movement.reference_name,
        createdAt: movement.created_at,
        externalProductName: movement.external_product_name,
        externalProductCategory: movement.external_product_category
      }));

      setStockMovements(movements);
    } catch (error) {
      console.error('Error fetching stock movements:', error);
    }
  };

  // Calculate stock summary with external vs internal breakdown
  const calculateStockSummary = async () => {
    try {
      let summaryQuery = supabase
        .from('inventory_items')
        .select(`
          product_id,
          product_name,
          color,
          size,
          current_stock
        `);

      if (user.role === 'agent' || user.role === 'agency') {
        summaryQuery = summaryQuery.eq('agency_id', user.agencyId);
      }

      const { data: summaryData, error: summaryError } = await summaryQuery;
      
      if (summaryError) {
        console.error('Error calculating stock summary:', summaryError);
        return;
      }

      // Get transaction details for each product
      // Get product details for summary
      const summaryProductIds = [...new Set((summaryData || []).map(item => item.product_id).filter(Boolean))];
      let summaryProductDetails = new Map();
      
      if (summaryProductIds.length > 0) {
        const { data: summaryProductsData } = await supabase
          .from('products')
          .select('id, category, sub_category')
          .in('id', summaryProductIds);
        
        if (summaryProductsData) {
          summaryProductsData.forEach(product => {
            summaryProductDetails.set(product.id, product);
          });
        }
      }

      const summary: StockSummary[] = [];
      
      for (const item of summaryData || []) {
        let transactionQuery = supabase
          .from('inventory_transactions')
          .select('transaction_type, quantity')
          .eq('product_name', item.product_name)
          .eq('color', item.color)
          .eq('size', item.size);

        if (user.role === 'agent' || user.role === 'agency') {
          transactionQuery = transactionQuery.eq('agency_id', user.agencyId);
        }

        const { data: transactions } = await transactionQuery;
        
        let stockIn = 0;
        let stockOut = 0;
        
        for (const transaction of transactions || []) {
          if (transaction.transaction_type === 'external_invoice' || 
              transaction.transaction_type === 'grn_acceptance' ||
              transaction.transaction_type === 'customer_return') {
            stockIn += Math.abs(transaction.quantity);
          } else if (transaction.transaction_type === 'invoice_creation' ||
                     transaction.transaction_type === 'company_return') {
            stockOut += Math.abs(transaction.quantity);
          }
        }
        
        const product = summaryProductDetails.get(item.product_id);
        summary.push({
          productName: item.product_name,
          color: item.color,
          size: item.size,
          category: product?.sub_category || 'Unknown',
          currentStock: item.current_stock,
          stockIn,
          stockOut,
          balance: stockIn - stockOut
        });
      }
      
      setStockSummary(summary);
    } catch (error) {
      console.error('Error calculating stock summary:', error);
    }
  };

  // Auto-refresh inventory data periodically
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing inventory data...');
      fetchInventoryData();
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(autoRefreshInterval);
  }, []);

  const handleSyncComplete = () => {
    // Refresh inventory data after sync
    fetchInventoryData();
    console.log('Inventory sync completed');
  };

  // Load data on component mount
  useEffect(() => {
    fetchInventoryData();
  }, [user.id, user.role, user.agencyId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading inventory data...</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-screen bg-gray-50">
      {/* Category Sidebar */}
      <InventoryCategorySidebar
        inventoryItems={inventoryItems}
        selectedCategory={categoryFilter}
        onCategorySelect={setCategoryFilter}
        searchTerm={sidebarSearchTerm}
        onSearchChange={setSidebarSearchTerm}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-gray-600">
            {user.role === 'superuser' ? 'All agency inventory with automatic external sync' : 'Your agency stock levels with automatic external sync'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Auto-sync Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700">Auto-sync Active</span>
          </div>
          
          {/* Manual Refresh Button */}
          <Button 
            onClick={() => fetchInventoryData()}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          
          {/* Odoo Sync Button */}
          <InventorySyncButton user={user} onSyncComplete={handleSyncComplete} />
          
          {/* Stock Adjustment Buttons */}
          {(user.role === 'agent' || user.role === 'agency') && (
            <>
              <Button 
                onClick={() => setShowBulkAdjustmentForm(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Bulk Adjustment
              </Button>
              <Button 
                onClick={() => setShowAdjustmentForm(true)}
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Single Item
              </Button>
              <Button 
                onClick={() => setShowAdjustmentHistory(true)}
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Requests
              </Button>
            </>
          )}
          
          {user.role === 'superuser' && (
            <>
              <Button 
                onClick={() => setShowBulkAdjustmentForm(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Bulk Adjustment
              </Button>
              <Button 
                onClick={() => setShowAdjustmentForm(true)}
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Single Item
              </Button>
              <Button 
                onClick={() => setShowAdjustmentHistory(true)}
                variant="outline"
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Requests
              </Button>
              <Button 
                onClick={() => setShowApprovalInterface(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Approve Adjustments
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stock Overview
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Stock Movements
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            External vs Internal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{filteredItems.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold">LKR {totalValue.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-orange-600">{lowStockItems}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{outOfStockItems}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Subcategories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subcategories</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => {
          setSearchTerm('');
          setCategoryFilter('all');
          setStockFilter('all');
          setSidebarSearchTerm('');
        }}>
          Clear Filters
        </Button>
      </div>

        {/* Current Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Current Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
                <p className="text-gray-600">
                  {searchTerm || (categoryFilter !== 'all') || (stockFilter !== 'all')
                    ? 'Try adjusting your search and filter criteria'
                    : 'No inventory items available. Use the sync buttons to import products.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const StatusIcon = stockStatus.icon;
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <StatusIcon className={`h-6 w-6 ${
                          stockStatus.variant === 'destructive' ? 'text-red-600' :
                          stockStatus.variant === 'secondary' ? 'text-orange-600' :
                          'text-green-600'
                        }`} />
                        <div>
                          <h4 className="font-medium">{item.productName}</h4>
                          <p className="text-sm text-gray-600">
                            {item.color} • {item.size} • {item.category}
                            {item.subCategory && ` • ${item.subCategory}`}
                          </p>
                          {user.role === 'superuser' && (
                            <p className="text-xs text-gray-500">Agency: {item.agencyId}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Current Stock</p>
                          <p className="text-lg font-semibold">{item.currentStock}</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Min Level</p>
                          <p className="text-lg">{item.minStockLevel}</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Unit Price</p>
                          <p className="text-lg">LKR {item.unitPrice}</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Total Value</p>
                          <p className="text-lg font-semibold">LKR {(item.currentStock * item.unitPrice).toLocaleString()}</p>
                        </div>

                        <Badge variant={stockStatus.variant}>
                          {stockStatus.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              {stockMovements.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No stock movements found</h3>
                  <p className="text-gray-600">No recent stock transactions available.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockMovements.map((movement) => {
                    const isStockIn = movement.quantity > 0;
                    const isExternal = movement.transactionType === 'external_invoice';
                    
                    return (
                      <div key={movement.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          {isStockIn ? (
                            <ArrowUp className="h-6 w-6 text-green-600" />
                          ) : (
                            <ArrowDown className="h-6 w-6 text-red-600" />
                          )}
                          <div>
                            <h4 className="font-medium">{movement.productName}</h4>
                            <p className="text-sm text-gray-600">
                              {movement.color} • {movement.size}
                            </p>
                            {isExternal && movement.externalProductName && (
                              <p className="text-xs text-blue-600">
                                External: {movement.externalProductName} ({movement.externalProductCategory})
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Quantity</p>
                            <p className={`text-lg font-semibold ${
                              isStockIn ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isStockIn ? '+' : ''}{movement.quantity}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Reference</p>
                            <p className="text-sm">{movement.referenceName}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Date</p>
                            <p className="text-sm">{new Date(movement.createdAt).toLocaleDateString()}</p>
                          </div>

                          <Badge variant={isExternal ? 'secondary' : 'default'}>
                            {isExternal ? 'External' : 'Internal'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock Balance: External vs Internal</CardTitle>
            </CardHeader>
            <CardContent>
              {stockSummary.length === 0 ? (
                <div className="text-center py-12">
                  <ExternalLink className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No stock summary available</h3>
                  <p className="text-gray-600">No products with stock transactions found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockSummary
                    .filter(item => {
                      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                           item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                           item.size.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesCategory = categoryFilter === 'all' || item.subCategory === categoryFilter;
                      return matchesSearch && matchesCategory;
                    })
                    .map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{item.productName}</h4>
                          <p className="text-sm text-gray-600">
                            {item.color} • {item.size} • {item.category}
                            {item.subCategory && ` • ${item.subCategory}`}
                          </p>
                        </div>
                        <Badge variant={item.currentStock > 0 ? 'default' : 'destructive'}>
                          Current: {item.currentStock}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <ArrowUp className="h-4 w-4 text-green-600" />
                            <p className="text-sm text-green-700 font-medium">Stock IN</p>
                          </div>
                          <p className="text-lg font-semibold text-green-600">{item.stockIn}</p>
                          <p className="text-xs text-green-600">External + Returns</p>
                        </div>
                        
                        <div className="text-center p-3 bg-red-50 rounded">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <ArrowDown className="h-4 w-4 text-red-600" />
                            <p className="text-sm text-red-700 font-medium">Stock OUT</p>
                          </div>
                          <p className="text-lg font-semibold text-red-600">{item.stockOut}</p>
                          <p className="text-xs text-red-600">Internal Sales</p>
                        </div>
                        
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Package className="h-4 w-4 text-blue-600" />
                            <p className="text-sm text-blue-700 font-medium">Balance</p>
                          </div>
                          <p className={`text-lg font-semibold ${
                            item.balance >= 0 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {item.balance >= 0 ? '+' : ''}{item.balance}
                          </p>
                          <p className="text-xs text-blue-600">Calculated</p>
                        </div>
                        
                        <div className="text-center p-3 bg-gray-50 rounded">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <AlertTriangle className="h-4 w-4 text-gray-600" />
                            <p className="text-sm text-gray-700 font-medium">Variance</p>
                          </div>
                          <p className={`text-lg font-semibold ${
                            Math.abs(item.currentStock - item.balance) <= 1 ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {item.currentStock - item.balance >= 0 ? '+' : ''}{item.currentStock - item.balance}
                          </p>
                          <p className="text-xs text-gray-600">Current vs Calc</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </div>

    {/* Stock Adjustment Form Modal */}
    {showAdjustmentForm && (
      <StockAdjustmentForm
        user={user}
        inventoryItems={inventoryItems}
        onClose={() => setShowAdjustmentForm(false)}
        onSubmitted={() => {
          // Refresh inventory data after submission
          fetchInventoryData();
        }}
      />
    )}

    {/* Bulk Stock Adjustment Form Modal */}
    {showBulkAdjustmentForm && (
      <BulkStockAdjustmentForm
        user={user}
        inventoryItems={inventoryItems}
        onClose={() => setShowBulkAdjustmentForm(false)}
        onSubmitted={() => {
          // Refresh inventory data after submission
          fetchInventoryData();
        }}
      />
    )}

    {/* Stock Adjustment Approval Modal */}
    {showApprovalInterface && user.role === 'superuser' && (
      <StockAdjustmentApproval
        user={user}
        onClose={() => setShowApprovalInterface(false)}
        onApprovalComplete={() => {
          // Refresh inventory data after approval
          fetchInventoryData();
        }}
      />
    )}

    {/* Stock Adjustment History Modal */}
    {showAdjustmentHistory && (
      <StockAdjustmentHistory
        user={user}
        onClose={() => setShowAdjustmentHistory(false)}
      />
    )}
  </>
  );
};

export default Inventory;
