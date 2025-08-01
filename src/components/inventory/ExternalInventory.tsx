import { useState, useEffect, useMemo } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Search, AlertTriangle, TrendingDown, Plus, ExternalLink, ArrowDown, ArrowUp, RefreshCw, Settings, BarChart3, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { externalInventoryService, ExternalInventoryItem, ExternalInventoryTransaction, ExternalInventoryMetrics } from '@/services/external-inventory.service';
import { externalBotSyncService } from '@/services/external-bot-sync';
import ExternalBulkStockAdjustmentForm from './ExternalBulkStockAdjustmentForm';
import ExternalStockAdjustmentApproval from './ExternalStockAdjustmentApproval';
import ExternalStockAdjustmentHistory from './ExternalStockAdjustmentHistory';

interface ExternalInventoryProps {
  user: User;
}

const ExternalInventory = ({ user }: ExternalInventoryProps) => {
  const [inventoryItems, setInventoryItems] = useState<ExternalInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<ExternalInventoryTransaction[]>([]);
  const [metrics, setMetrics] = useState<ExternalInventoryMetrics | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategorySidebar, setShowCategorySidebar] = useState(true);
  const [stockFilter, setStockFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBulkAdjustment, setShowBulkAdjustment] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  // Memoized filtered items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.size.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSelectedCategory = selectedCategory === null || item.category === selectedCategory;
      
      let matchesStockFilter = true;
      if (stockFilter === 'low') {
        matchesStockFilter = item.current_stock > 0 && item.current_stock <= 5;
      } else if (stockFilter === 'out') {
        matchesStockFilter = item.current_stock <= 0;
      } else if (stockFilter === 'in-stock') {
        matchesStockFilter = item.current_stock > 0;
      }
      
      return matchesSearch && matchesCategory && matchesSelectedCategory && matchesStockFilter;
    });
  }, [inventoryItems, searchTerm, categoryFilter, selectedCategory, stockFilter]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const grouped: { [key: string]: ExternalInventoryItem[] } = {};
    
    filteredItems.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    return grouped;
  }, [filteredItems]);

  // Category statistics
  const categoryStats = useMemo(() => {
    const stats: { [key: string]: { total: number; lowStock: number; outOfStock: number; totalValue: number } } = {};
    
    inventoryItems.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!stats[category]) {
        stats[category] = { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
      }
      
      stats[category].total += 1;
      stats[category].totalValue += item.current_stock * (item.avg_unit_price || 0);
      
      if (item.current_stock <= 0) {
        stats[category].outOfStock += 1;
      } else if (item.current_stock <= 5) {
        stats[category].lowStock += 1;
      }
    });
    
    return stats;
  }, [inventoryItems]);

  const getStockStatus = (item: ExternalInventoryItem) => {
    if (item.current_stock <= 0) {
      return { status: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (item.current_stock <= 5) {
      return { status: 'Low Stock', variant: 'secondary' as const, icon: TrendingDown };
    } else {
      return { status: 'In Stock', variant: 'default' as const, icon: Package };
    }
  };

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [itemsData, transactionsData, metricsData, categoriesData] = await Promise.all([
        externalInventoryService.getStockSummary(user.agencyId),
        externalInventoryService.getTransactionHistory(user.agencyId, 50),
        externalInventoryService.getInventoryMetrics(user.agencyId),
        externalInventoryService.getCategories(user.agencyId)
      ]);

      setInventoryItems(itemsData);
      setTransactions(transactionsData);
      setMetrics(metricsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching external inventory data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Sync external bot invoices
  const handleSync = async () => {
    try {
      setSyncing(true);
      toast({
        title: "Sync Started",
        description: "Syncing external bot invoices...",
      });

      const result = await externalBotSyncService.syncInvoices(user.id);
      
      if (result.success) {
        toast({
          title: "Sync Completed",
          description: `${result.message} - ${result.details?.processedCount || 0} items processed`,
        });
        
        // Refresh data
        await fetchData();
      } else {
        toast({
          title: "Sync Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync external invoices",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.agencyId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading external inventory data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">External Inventory Management</h2>
          <p className="text-gray-600">
            Complete inventory system with external bot integration
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button 
            onClick={fetchData}
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
          
          <Button 
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {syncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Sync External Bot
          </Button>

          <Button 
            onClick={() => setShowBulkAdjustment(true)}
            variant="outline"
            className="bg-orange-50 hover:bg-orange-100 text-orange-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Bulk Adjustment
          </Button>

          {user.role === 'superuser' && (
            <Button 
              onClick={() => setShowApprovals(true)}
              variant="outline"
              className="bg-green-50 hover:bg-green-100 text-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Approvals
            </Button>
          )}

          <Button 
            onClick={() => setShowHistory(true)}
            variant="outline"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold">{metrics.totalItems}</p>
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
                  <p className="text-2xl font-bold">LKR {metrics.totalValue.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-orange-600">{metrics.lowStockItems}</p>
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
                  <p className="text-2xl font-bold text-red-600">{metrics.outOfStockItems}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold">{metrics.totalTransactions}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stock Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Transaction History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="flex gap-6">
            {/* Category Sidebar */}
            {showCategorySidebar && (
              <div className="w-64 bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Categories</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowCategorySidebar(false)}
                    className="p-1"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setCategoryFilter('all');
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                    selectedCategory === null 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">All Items</span>
                  </div>
                  <span className="text-sm text-gray-600">{inventoryItems.length}</span>
                </button>

                {Object.entries(categoryStats).map(([category, stats]) => {
                  const isSelected = selectedCategory === category;
                  const IconComponent = isSelected ? FolderOpen : Folder;
                  
                  return (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setCategoryFilter(category);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        isSelected 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="h-4 w-4" />
                        <span className="font-medium">{category}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span>{stats.total}</span>
                        </div>
                        {stats.lowStock > 0 && (
                          <div className="flex justify-between text-orange-600">
                            <span>Low Stock:</span>
                            <span>{stats.lowStock}</span>
                          </div>
                        )}
                        {stats.outOfStock > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Out of Stock:</span>
                            <span>{stats.outOfStock}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-green-600">
                          <span>Value:</span>
                          <span>LKR {stats.totalValue.toLocaleString()}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 space-y-6">
              {!showCategorySidebar && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCategorySidebar(true)}
                  className="mb-4"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Show Categories
                </Button>
              )}

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Stock Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="in-stock">In Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setSelectedCategory(null);
                  setStockFilter('all');
                }}>
                  Clear Filters
                </Button>
              </div>

              {/* Stock Items by Category */}
              {selectedCategory ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      {selectedCategory} ({filteredItems.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredItems.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No items found in {selectedCategory}</h3>
                        <p className="text-gray-600">
                          {searchTerm || (stockFilter !== 'all')
                            ? 'Try adjusting your search and filter criteria'
                            : `No items available in the ${selectedCategory} category.`
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredItems.map((item, index) => {
                          const stockStatus = getStockStatus(item);
                          const StatusIcon = stockStatus.icon;
                          
                          return (
                            <div key={`${item.product_name}-${item.color}-${item.size}-${index}`} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                              <div className="flex items-center gap-4">
                                <StatusIcon className={`h-6 w-6 ${
                                  stockStatus.variant === 'destructive' ? 'text-red-600' :
                                  stockStatus.variant === 'secondary' ? 'text-orange-600' :
                                  'text-green-600'
                                }`} />
                                <div>
                                  <h4 className="font-medium">{item.product_name}</h4>
                                  <div className="flex gap-2 text-sm text-gray-600">
                                    {item.product_code && (
                                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">{item.product_code}</span>
                                    )}
                                    <span>{item.color}</span>
                                    <span>•</span>
                                    <span>{item.size}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Current Stock</p>
                                  <p className="text-lg font-semibold">{item.current_stock}</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Stock IN</p>
                                  <p className="text-lg text-green-600">{item.total_stock_in}</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Stock OUT</p>
                                  <p className="text-lg text-red-600">{item.total_stock_out}</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Avg Price</p>
                                  <p className="text-lg">LKR {item.avg_unit_price?.toFixed(2) || '0.00'}</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Total Value</p>
                                  <p className="text-lg font-semibold">LKR {(item.current_stock * (item.avg_unit_price || 0)).toLocaleString()}</p>
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
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedItems).length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
                      <p className="text-gray-600">
                        {searchTerm || (stockFilter !== 'all')
                          ? 'Try adjusting your search and filter criteria'
                          : 'No external inventory items available. Use the sync button to import from external bot.'
                        }
                      </p>
                    </div>
                  ) : (
                    Object.entries(groupedItems).map(([category, items]) => (
                      <Card key={category}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Folder className="h-5 w-5" />
                              {category} ({items.length} items)
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCategory(category);
                                setCategoryFilter(category);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              View All <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {items.slice(0, 3).map((item, index) => {
                              const stockStatus = getStockStatus(item);
                              const StatusIcon = stockStatus.icon;
                              
                              return (
                                <div key={`${item.product_name}-${item.color}-${item.size}-${index}`} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                                  <div className="flex items-center gap-4">
                                    <StatusIcon className={`h-6 w-6 ${
                                      stockStatus.variant === 'destructive' ? 'text-red-600' :
                                      stockStatus.variant === 'secondary' ? 'text-orange-600' :
                                      'text-green-600'
                                    }`} />
                                    <div>
                                      <h4 className="font-medium">{item.product_name}</h4>
                                      <div className="flex gap-2 text-sm text-gray-600">
                                        {item.product_code && (
                                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">{item.product_code}</span>
                                        )}
                                        <span>{item.color}</span>
                                        <span>•</span>
                                        <span>{item.size}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-6">
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Current Stock</p>
                                      <p className="text-lg font-semibold">{item.current_stock}</p>
                                    </div>
                                    
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Stock IN</p>
                                      <p className="text-lg text-green-600">{item.total_stock_in}</p>
                                    </div>
                                    
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Stock OUT</p>
                                      <p className="text-lg text-red-600">{item.total_stock_out}</p>
                                    </div>
                                    
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Avg Price</p>
                                      <p className="text-lg">LKR {item.avg_unit_price?.toFixed(2) || '0.00'}</p>
                                    </div>
                                    
                                    <div className="text-center">
                                      <p className="text-sm text-gray-600">Total Value</p>
                                      <p className="text-lg font-semibold">LKR {(item.current_stock * (item.avg_unit_price || 0)).toLocaleString()}</p>
                                    </div>

                                    <Badge variant={stockStatus.variant}>
                                      {stockStatus.status}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                            {items.length > 3 && (
                              <div className="text-center pt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCategory(category);
                                    setCategoryFilter(category);
                                  }}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  Show {items.length - 3} more items <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                  <p className="text-gray-600">No transaction history available.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => {
                    const isStockIn = transaction.quantity > 0;
                    
                    return (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          {isStockIn ? (
                            <ArrowUp className="h-6 w-6 text-green-600" />
                          ) : (
                            <ArrowDown className="h-6 w-6 text-red-600" />
                          )}
                          <div>
                            <h4 className="font-medium">{transaction.product_name}</h4>
                            <div className="flex gap-2 text-sm text-gray-600">
                              {transaction.product_code && (
                                <span className="bg-gray-100 px-2 py-1 rounded text-xs">{transaction.product_code}</span>
                              )}
                              <span>{transaction.color}</span>
                              <span>•</span>
                              <span>{transaction.size}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Quantity</p>
                            <p className={`text-lg font-semibold ${
                              isStockIn ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isStockIn ? '+' : ''}{transaction.quantity}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Reference</p>
                            <p className="text-sm">{transaction.reference_name || 'N/A'}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-gray-600">User</p>
                            <p className="text-sm">{transaction.user_name || 'System'}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Date</p>
                            <p className="text-sm">{new Date(transaction.transaction_date).toLocaleDateString()}</p>
                          </div>

                          <Badge variant={
                            transaction.transaction_type === 'external_invoice' ? 'secondary' : 
                            transaction.transaction_type === 'adjustment' ? 'default' :
                            transaction.transaction_type === 'sale' ? 'destructive' :
                            'outline'
                          }>
                            {transaction.transaction_type.replace('_', ' ').toUpperCase()}
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
      </Tabs>

      {/* Adjustment Forms and Modals */}
      {showBulkAdjustment && (
        <ExternalBulkStockAdjustmentForm
          user={user}
          onClose={() => setShowBulkAdjustment(false)}
          onSubmitted={() => {
            fetchData();
            toast({
              title: "Adjustment Submitted",
              description: "Your bulk stock adjustment has been submitted for approval",
            });
          }}
        />
      )}

      {showApprovals && (
        <ExternalStockAdjustmentApproval
          user={user}
          onClose={() => setShowApprovals(false)}
          onApprovalComplete={() => {
            fetchData();
          }}
        />
      )}

      {showHistory && (
        <ExternalStockAdjustmentHistory
          user={user}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

export default ExternalInventory;