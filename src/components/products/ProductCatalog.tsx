import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { User } from '@/types/auth';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductCatalogProps {
  user: User;
}

const ProductCatalog = memo(({ user }: ProductCatalogProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subCategory: '',
    colors: [''],
    sizes: [''],
    sellingPrice: '',
    billingPrice: '',
    description: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, category, sub_category, colors, sizes,
          selling_price, billing_price, description, created_at
        `)
        .order('created_at', { ascending: false })
        .limit(200); // Limit to improve performance

      if (error) throw error;

      const formattedProducts = data.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        subCategory: product.sub_category || '',
        colors: product.colors || [],
        sizes: product.sizes || [],
        sellingPrice: Number(product.selling_price),
        billingPrice: Number(product.billing_price),
        description: product.description || ''
      }));

      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        sub_category: formData.subCategory,
        colors: formData.colors.filter(color => color.trim() !== ''),
        sizes: formData.sizes.filter(size => size.trim() !== ''),
        selling_price: Number(formData.sellingPrice),
        billing_price: Number(formData.billingPrice),
        description: formData.description
      };

      let result;
      if (editingProduct) {
        result = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
      } else {
        result = await supabase
          .from('products')
          .insert([productData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Product ${editingProduct ? 'updated' : 'created'} successfully`,
      });

      setShowCreateForm(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingProduct ? 'update' : 'create'} product`,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      subCategory: '',
      colors: [''],
      sizes: [''],
      sellingPrice: '',
      billingPrice: '',
      description: ''
    });
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      subCategory: product.subCategory,
      colors: product.colors.length > 0 ? product.colors : [''],
      sizes: product.sizes.length > 0 ? product.sizes : [''],
      sellingPrice: product.sellingPrice.toString(),
      billingPrice: product.billingPrice.toString(),
      description: product.description || ''
    });
    setShowCreateForm(true);
  };

  const addColorField = () => {
    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, '']
    }));
  };

  const addSizeField = () => {
    setFormData(prev => ({
      ...prev,
      sizes: [...prev.sizes, '']
    }));
  };

  const updateColor = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.map((color, i) => i === index ? value : color)
    }));
  };

  const updateSize = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.map((size, i) => i === index ? value : size)
    }));
  };

  const removeColor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index)
    }));
  };

  const removeSize = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index)
    }));
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = [...new Set(products.map(p => p.category))];

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => {
            setShowCreateForm(false);
            setEditingProduct(null);
            resetForm();
          }}>
            ← Back to Products
          </Button>
          <h2 className="text-2xl font-bold">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </h2>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter product name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category *</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Enter category"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sub Category</label>
                  <Input
                    value={formData.subCategory}
                    onChange={(e) => setFormData(prev => ({ ...prev, subCategory: e.target.value }))}
                    placeholder="Enter sub category"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter description"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Selling Price (LKR) *</label>
                  <Input
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                    placeholder="0.00"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Billing Price (LKR) *</label>
                  <Input
                    type="number"
                    value={formData.billingPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, billingPrice: e.target.value }))}
                    placeholder="0.00"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Colors</label>
                  {formData.colors.map((color, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={color}
                        onChange={(e) => updateColor(index, e.target.value)}
                        placeholder="Enter color"
                      />
                      {formData.colors.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeColor(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColorField}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Color
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sizes</label>
                  {formData.sizes.map((size, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={size}
                        onChange={(e) => updateSize(index, e.target.value)}
                        placeholder="Enter size"
                      />
                      {formData.sizes.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSize(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSizeField}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Size
                  </Button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Catalog</h2>
          <p className="text-gray-600">Manage your product inventory</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || categoryFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first product'
            }
          </p>
          {!searchTerm && categoryFilter === 'all' && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <p className="text-sm text-gray-600">{product.category}</p>
                    {product.subCategory && (
                      <p className="text-xs text-gray-500">{product.subCategory}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Selling:</span>
                      <p className="font-medium">LKR {product.sellingPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Billing:</span>
                      <p className="font-medium">LKR {product.billingPrice.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {product.colors.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">Colors:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.colors.map((color, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {color}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {product.sizes.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600">Sizes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.sizes.map((size, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {size}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {product.description && (
                    <div>
                      <span className="text-sm text-gray-600">Description:</span>
                      <p className="text-sm mt-1">{product.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

});

ProductCatalog.displayName = 'ProductCatalog';

export default ProductCatalog;
