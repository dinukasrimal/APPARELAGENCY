import { useState } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search, AlertTriangle, TrendingDown, Plus } from 'lucide-react';
import InventorySyncButton from './InventorySyncButton';

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  color: string;
  size: string;
  currentStock: number;
  minStockLevel: number;
  unitPrice: number;
  agencyId: string;
  lastUpdated: Date;
}

interface InventoryProps {
  user: User;
}

const Inventory = ({ user }: InventoryProps) => {
  const [inventoryItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Filter items based on user role and filters
  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.size.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesAgency = user.role === 'superuser' || item.agencyId === user.agencyId;
    
    let matchesStockFilter = true;
    if (stockFilter === 'low') {
      matchesStockFilter = item.currentStock <= item.minStockLevel;
    } else if (stockFilter === 'out') {
      matchesStockFilter = item.currentStock === 0;
    }
    
    return matchesSearch && matchesCategory && matchesAgency && matchesStockFilter;
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

  const totalValue = filteredItems.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);
  const lowStockItems = filteredItems.filter(item => item.currentStock <= item.minStockLevel).length;
  const outOfStockItems = filteredItems.filter(item => item.currentStock === 0).length;

  const handleSyncComplete = () => {
    // Refresh inventory data after sync
    // This would typically trigger a refetch of inventory items
    console.log('Inventory sync completed');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-gray-600">
            {user.role === 'superuser' ? 'All agency inventory' : 'Your agency stock levels'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Odoo Sync Button */}
          <InventorySyncButton user={user} onSyncComplete={handleSyncComplete} />
          
          {/* Stock Adjustment Button (for superuser) */}
          {user.role === 'superuser' && (
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Stock Adjustment
            </Button>
          )}
        </div>
      </div>

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
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Men's Wear">Men's Wear</SelectItem>
            <SelectItem value="Women's Wear">Women's Wear</SelectItem>
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
        }}>
          Clear Filters
        </Button>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory items found</h3>
              <p className="text-gray-600">
                {searchTerm || (categoryFilter !== 'all') || (stockFilter !== 'all')
                  ? 'Try adjusting your search and filter criteria'
                  : 'No inventory items available. Use the "Sync from Odoo" button to import products.'
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
    </div>
  );
};

export default Inventory;
