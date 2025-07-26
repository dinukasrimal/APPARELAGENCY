import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Edit, Trash2, Package, Grid, List, Image as ImageIcon, Upload, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProductForm from './ProductForm';

interface ProductCatalogWithCategoriesProps {
  user: User;
}

interface CategoryGroup {
  category: string;
  subCategories: {
    [subCategory: string]: Product[];
  };
  totalCount: number;
}

const ProductCatalogWithCategories = ({ user }: ProductCatalogWithCategoriesProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const { toast } = useToast();

  const triggerImageUpload = (productId: string, event?: React.MouseEvent) => {
    console.log('Trigger image upload called for product:', productId);
    
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      event.nativeEvent?.stopPropagation();
      event.nativeEvent?.stopImmediatePropagation();
    }
    
    // Only allow superusers to upload images
    if (user.role !== 'superuser') {
      console.log('Access denied - user role:', user.role);
      toast({
        title: "Access Denied",
        description: "Only superusers can upload product images.",
        variant: "destructive",
      });
      return;
    }
    
    const fileInput = document.getElementById(`upload-${productId}`) as HTMLInputElement;
    console.log('File input found:', !!fileInput);
    if (fileInput) {
      fileInput.click();
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;

      const formattedProducts: Product[] = data.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        subCategory: product.sub_category || '',
        colors: product.colors || [],
        sizes: product.sizes || [],
        sellingPrice: Number(product.selling_price),
        billingPrice: Number(product.billing_price),
        image: product.image || undefined,
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
  };

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: productData.name,
          category: productData.category,
          sub_category: productData.subCategory,
          colors: productData.colors,
          sizes: productData.sizes,
          selling_price: productData.sellingPrice,
          billing_price: productData.billingPrice,
          image: productData.image,
          description: productData.description
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product added successfully",
      });

      setShowCreateForm(false);
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive"
      });
    }
  };

  const handleUpdateProduct = async (productData: Omit<Product, 'id'>) => {
    if (!editingProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: productData.name,
          category: productData.category,
          sub_category: productData.subCategory,
          colors: productData.colors,
          sizes: productData.sizes,
          selling_price: productData.sellingPrice,
          billing_price: productData.billingPrice,
          image: productData.image,
          description: productData.description
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product updated successfully",
      });

      setShowCreateForm(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
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

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setShowCreateForm(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, product: Product) => {
    try {
      // Prevent all event propagation
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      console.log('Image upload started for product:', product.id);
      console.log('Selected files:', event.target.files);
      setUploadingImage(product.id);

      if (!event.target.files || event.target.files.length === 0) {
        console.log('No files selected');
        setUploadingImage(null);
        return;
      }

      const file = event.target.files[0];
      console.log('Selected file:', file.name, file.type, file.size);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file (JPG, PNG, GIF, WebP).');
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${product.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        // Handle common storage errors
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket not configured. Please contact administrator to set up image storage.');
        }
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const imageUrl = data.publicUrl;

      // Update product in database
      const { error: updateError } = await supabase
        .from('products')
        .update({ image: imageUrl })
        .eq('id', product.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Success",
        description: "Product image uploaded successfully",
      });

      // Refresh products to show the new image
      fetchProducts();

    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(null);
      // Reset the input value to allow re-uploading the same file
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Group products by category and subcategory
  const groupedProducts = products.reduce((acc, product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.subCategory.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return acc;

    if (!acc[product.category]) {
      acc[product.category] = {
        category: product.category,
        subCategories: {},
        totalCount: 0
      };
    }

    const subCategory = product.subCategory || 'General';
    if (!acc[product.category].subCategories[subCategory]) {
      acc[product.category].subCategories[subCategory] = [];
    }

    acc[product.category].subCategories[subCategory].push(product);
    acc[product.category].totalCount++;

    return acc;
  }, {} as { [key: string]: CategoryGroup });

  const categories = Object.keys(groupedProducts).sort();
  const filteredCategories = selectedCategory === 'all' 
    ? categories 
    : categories.filter(cat => cat === selectedCategory);

  if (showCreateForm) {
    return (
      <ProductForm
        product={editingProduct || undefined}
        onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}
        onCancel={() => {
          setShowCreateForm(false);
          setEditingProduct(null);
        }}
        userRole={user.role}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Modern Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Product Catalog</h2>
                <p className="text-lg text-slate-600 font-medium">Browse products by category and subcategory</p>
              </div>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="group relative w-full sm:w-auto h-14 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                Add Product
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Search and Controls */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                placeholder="Search products, categories, or subcategories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-14 px-4 border border-slate-200 rounded-xl bg-white/90 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category} ({groupedProducts[category].totalCount})
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setViewMode('grid')}
                className="h-14 px-6 rounded-xl font-medium transition-all duration-200"
              >
                <Grid className="h-5 w-5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="lg"
                onClick={() => setViewMode('list')}
                className="h-14 px-6 rounded-xl font-medium transition-all duration-200"
              >
                <List className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Products Display */}
        {isLoading ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-white/20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-slate-600 font-medium">Loading products...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-white/20">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Package className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">No products found</h3>
            <p className="text-slate-600 text-lg mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first product'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Product
              </Button>
            )}
          </div>
      ) : (
        <div className="space-y-8">
          {filteredCategories.map((categoryName) => {
            const categoryData = groupedProducts[categoryName];
            const subCategories = Object.keys(categoryData.subCategories).sort();
            
            return (
              <Card key={categoryName} className="group bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-white/20">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-full w-10 h-10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {categoryName}
                      </span>
                    </span>
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium px-3 py-1 rounded-full">
                      {categoryData.totalCount} products
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue={subCategories[0]} className="w-full">
                    <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 bg-slate-100/70 p-2 rounded-xl m-4">
                      {subCategories.map((subCategory) => (
                        <TabsTrigger 
                          key={subCategory} 
                          value={subCategory} 
                          className="text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all duration-200"
                        >
                          {subCategory} ({categoryData.subCategories[subCategory].length})
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {subCategories.map((subCategory) => (
                      <TabsContent key={subCategory} value={subCategory} className="p-6">
                        <div className={
                          viewMode === 'grid' 
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                            : "space-y-4"
                        }>
                          {categoryData.subCategories[subCategory].map((product, index) => (
                            <Card 
                              key={product.id} 
                              className="group bg-white/90 backdrop-blur-sm border border-white/30 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-105"
                              style={{
                                animationDelay: `${index * 100}ms`
                              }}
                              onClick={(e) => {
                                console.log('Card clicked for product:', product.name);
                                // For now, prevent any card navigation
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              {viewMode === 'grid' ? (
                                // Grid View
                                <>
                                  <CardHeader className="pb-2">
                                    <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden relative">
                                      {product.image ? (
                                        <img
                                          src={product.image}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <ImageIcon className="h-8 w-8 text-gray-400" />
                                        </div>
                                      )}
                                      
                                      {/* Hidden File Input */}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, product)}
                                        disabled={uploadingImage === product.id}
                                        className="hidden"
                                        id={`upload-${product.id}`}
                                      />
                                      
                                      {/* Upload Button Overlay - Only show for superusers */}
                                      {user.role === 'superuser' && (
                                        <div 
                                          className="absolute top-2 right-2 z-50"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.stopImmediatePropagation();
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.stopImmediatePropagation();
                                          }}
                                          onMouseUp={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.stopImmediatePropagation();
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.stopImmediatePropagation();
                                              triggerImageUpload(product.id, e);
                                            }}
                                            disabled={uploadingImage === product.id}
                                            className="bg-white/90 hover:bg-white rounded-full p-2 shadow-lg cursor-pointer transition-all duration-200 flex items-center justify-center w-8 h-8 border-0 outline-none focus:ring-2 focus:ring-blue-500"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.stopImmediatePropagation();
                                            }}
                                            onMouseUp={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.stopImmediatePropagation();
                                            }}
                                          >
                                            {uploadingImage === product.id ? (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                            ) : (
                                              <Camera className="h-4 w-4 text-blue-600" />
                                            )}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <CardTitle className="text-sm font-medium line-clamp-2">
                                          {product.name}
                                        </CardTitle>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {product.subCategory || 'General'}
                                        </p>
                                      </div>
                                      <div className="flex gap-1 ml-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEdit(product);
                                          }}
                                          className="h-8 w-8 p-0 rounded-xl hover:bg-blue-100 transition-colors duration-200"
                                        >
                                          <Edit className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteProduct(product.id);
                                          }}
                                          className="h-8 w-8 p-0 rounded-xl hover:bg-red-100 transition-colors duration-200"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Selling:</span>
                                        <span className="font-medium">LKR {product.sellingPrice.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Billing:</span>
                                        <span className="font-medium">LKR {product.billingPrice.toLocaleString()}</span>
                                      </div>
                                      
                                      {product.colors.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {product.colors.slice(0, 3).map((color, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                              {color}
                                            </Badge>
                                          ))}
                                          {product.colors.length > 3 && (
                                            <Badge variant="secondary" className="text-xs">
                                              +{product.colors.length - 3}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                      
                                      {product.sizes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {product.sizes.slice(0, 3).map((size, index) => (
                                            <Badge key={index} variant="outline" className="text-xs">
                                              {size}
                                            </Badge>
                                          ))}
                                          {product.sizes.length > 3 && (
                                            <Badge variant="outline" className="text-xs">
                                              +{product.sizes.length - 3}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </>
                              ) : (
                                // List View
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                                      {product.image ? (
                                        <img
                                          src={product.image}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <ImageIcon className="h-6 w-6 text-gray-400" />
                                        </div>
                                      )}
                                      
                                      {/* Hidden File Input */}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, product)}
                                        disabled={uploadingImage === product.id}
                                        className="hidden"
                                        id={`upload-list-${product.id}`}
                                      />
                                      
                                      {/* Upload Button Overlay - Only show for superusers */}
                                      {user.role === 'superuser' && (
                                        <div 
                                          className="absolute top-1 right-1 z-50"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.stopImmediatePropagation();
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.stopImmediatePropagation();
                                          }}
                                          onMouseUp={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.stopImmediatePropagation();
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.stopImmediatePropagation();
                                              const fileInput = document.getElementById(`upload-list-${product.id}`) as HTMLInputElement;
                                              if (fileInput) {
                                                fileInput.click();
                                              }
                                            }}
                                            disabled={uploadingImage === product.id}
                                            className="bg-white/90 hover:bg-white rounded-full p-1 shadow-lg cursor-pointer transition-all duration-200 flex items-center justify-center w-6 h-6 border-0 outline-none focus:ring-2 focus:ring-blue-500"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.stopImmediatePropagation();
                                            }}
                                            onMouseUp={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              e.stopImmediatePropagation();
                                            }}
                                          >
                                            {uploadingImage === product.id ? (
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                            ) : (
                                              <Camera className="h-3 w-3 text-blue-600" />
                                            )}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex-1">
                                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                                      <p className="text-sm text-gray-600">{product.subCategory || 'General'}</p>
                                      {product.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                          {product.description}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="text-right">
                                      <div className="text-sm">
                                        <span className="text-gray-600">Selling: </span>
                                        <span className="font-medium">LKR {product.sellingPrice.toLocaleString()}</span>
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-gray-600">Billing: </span>
                                        <span className="font-medium">LKR {product.billingPrice.toLocaleString()}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEdit(product);
                                        }}
                                        className="h-10 w-10 p-0 rounded-xl hover:bg-blue-100 transition-colors duration-200"
                                      >
                                        <Edit className="h-4 w-4 text-blue-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteProduct(product.id);
                                        }}
                                        className="h-10 w-10 p-0 rounded-xl hover:bg-red-100 transition-colors duration-200"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCatalogWithCategories;