import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Search, ChevronRight, Grid3X3 } from 'lucide-react';
import { Input } from '@/components/ui/input';

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

interface CategoryData {
  name: string;
  count: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

interface InventoryCategorySidebarProps {
  inventoryItems: InventoryItem[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
}

const InventoryCategorySidebar = ({
  inventoryItems,
  selectedCategory,
  onCategorySelect,
  searchTerm,
  onSearchChange
}: InventoryCategorySidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate subcategory statistics
  const categoryStats = inventoryItems.reduce((acc, item) => {
    const category = item.subCategory || 'Uncategorized';
    
    if (!acc[category]) {
      acc[category] = {
        name: category,
        count: 0,
        totalStock: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalValue: 0
      };
    }

    acc[category].count += 1;
    acc[category].totalStock += item.currentStock;
    acc[category].totalValue += item.currentStock * item.unitPrice;

    if (item.currentStock === 0) {
      acc[category].outOfStockCount += 1;
    } else if (item.currentStock <= item.minStockLevel) {
      acc[category].lowStockCount += 1;
    }

    return acc;
  }, {} as Record<string, CategoryData>);

  const categories = Object.values(categoryStats).sort((a, b) => a.name.localeCompare(b.name));
  const totalItems = inventoryItems.length;
  const totalStock = inventoryItems.reduce((sum, item) => sum + item.currentStock, 0);
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <div className="w-16 bg-white border-r border-gray-200 p-2 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          className="w-full p-2 h-10"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
        
        <div className="space-y-1">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onCategorySelect('all')}
            className="w-full p-2 h-10 relative"
          >
            <Package className="h-4 w-4" />
            {selectedCategory === 'all' && (
              <div className="absolute -right-1 -top-1 w-2 h-2 bg-blue-600 rounded-full" />
            )}
          </Button>
          
          {categories.slice(0, 5).map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onCategorySelect(category.name)}
              className="w-full p-2 h-10 relative"
            >
              <span className="text-xs font-medium">
                {category.name.substring(0, 2).toUpperCase()}
              </span>
              {selectedCategory === category.name && (
                <div className="absolute -right-1 -top-1 w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Subcategories</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="p-1 h-6 w-6"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search subcategories..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-8"
          />
        </div>
      </div>

      {/* Overall Stats */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Items:</span>
            <span className="font-medium">{totalItems}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Stock:</span>
            <span className="font-medium">{totalStock.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Value:</span>
            <span className="font-medium">LKR {totalValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Category List */}
      <div className="flex-1 overflow-y-auto">
        {/* All Categories Option */}
        <div className="p-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'ghost'}
            onClick={() => onCategorySelect('all')}
            className="w-full justify-start h-auto p-3"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">All Subcategories</div>
                  <div className="text-xs text-gray-500">
                    {categories.length} subcategories
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="ml-2">
                {totalItems}
              </Badge>
            </div>
          </Button>
        </div>

        {/* Individual Categories */}
        <div className="px-2 pb-2 space-y-1">
          {filteredCategories.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? 'default' : 'ghost'}
              onClick={() => onCategorySelect(category.name)}
              className="w-full justify-start h-auto p-3"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {category.name.substring(0, 1)}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">{category.name}</div>
                    <div className="text-xs text-gray-500 space-x-2">
                      <span>{category.totalStock} units</span>
                      {category.lowStockCount > 0 && (
                        <span className="text-orange-600">
                          • {category.lowStockCount} low
                        </span>
                      )}
                      {category.outOfStockCount > 0 && (
                        <span className="text-red-600">
                          • {category.outOfStockCount} out
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="mb-1">
                    {category.count}
                  </Badge>
                  <div className="text-xs text-gray-500">
                    LKR {(category.totalValue / 1000).toFixed(0)}K
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>

        {filteredCategories.length === 0 && searchTerm && (
          <div className="p-4 text-center text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No subcategories found</p>
            <p className="text-xs">Try adjusting your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryCategorySidebar;