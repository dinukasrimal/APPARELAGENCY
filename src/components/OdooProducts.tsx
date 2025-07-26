import React, { useState, useEffect } from 'react';
import { useOdooProducts } from '@/hooks/useOdoo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const OdooProducts: React.FC = () => {
  const {
    products,
    isLoading,
    error,
    fetchProducts,
    searchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useOdooProducts(20);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchProducts(searchQuery);
    } else {
      await fetchProducts();
    }
  };

  const handleCreateProduct = async () => {
    setIsCreating(true);
    try {
      const newProduct = {
        name: 'New Product',
        list_price: 0.0,
        default_code: 'PROD001',
        description: 'Product description',
      };
      
      const id = await createProduct(newProduct);
      toast.success(`Product created with ID: ${id}`);
    } catch (error) {
      toast.error('Failed to create product');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteProduct(id);
        toast.success('Product deleted successfully');
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button onClick={fetchProducts} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Odoo Products</span>
            <Button onClick={handleCreateProduct} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Product
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading products...</span>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        {product.default_code && (
                          <p className="text-sm text-gray-600">Code: {product.default_code}</p>
                        )}
                        <p className="text-lg font-bold text-green-600">
                          ${product.list_price.toFixed(2)}
                        </p>
                        {product.description && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={product.active ? "default" : "secondary"}>
                            {product.active ? "Active" : "Inactive"}
                          </Badge>
                          {product.categ_id && (
                            <Badge variant="outline">{product.categ_id[1]}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button size="sm" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && products.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No products found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OdooProducts; 