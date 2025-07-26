import { useState } from 'react';
import { Product } from '@/types/product';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, Search, Grid, List, Plus, Camera, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductGridProps {
  products: Product[];
  user: User;
  onAdd?: () => void;
  onProductUpdate?: () => void;
  isLoading?: boolean;
}

const ProductGrid = ({ products, user, onAdd, onProductUpdate, isLoading = false }: ProductGridProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to list view
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, product: Product) => {
    try {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('Image upload started for product:', product.id);
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

      // Refresh products if callback provided
      if (onProductUpdate) {
        onProductUpdate();
      }

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

  const triggerImageUpload = (productId: string, event?: React.MouseEvent) => {
    console.log('Trigger image upload called for product:', productId);
    
    if (event) {
      event.preventDefault();
      event.stopPropagation();
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

  // Group products by color
  const groupProductsByColor = (products: Product[]) => {
    const colorGroups: { [key: string]: Product[] } = {};
    
    products.forEach(product => {
      if (product.colors && product.colors.length > 0) {
        product.colors.forEach(color => {
          if (!colorGroups[color]) {
            colorGroups[color] = [];
          }
          colorGroups[color].push(product);
        });
      } else {
        // Products without colors go to "No Color" group
        if (!colorGroups['No Color']) {
          colorGroups['No Color'] = [];
        }
        colorGroups['No Color'].push(product);
      }
    });
    
    return colorGroups;
  };

  const colorGroups = groupProductsByColor(filteredProducts);
  const colorGroupKeys = Object.keys(colorGroups).sort();

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white border-b border-gray-200 animate-pulse">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="h-3 bg-gray-200 rounded mb-1 w-20"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Modern Header */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-white/20 shadow-sm">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Products</h2>
              <p className="text-base text-slate-600 font-medium">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                {colorGroupKeys.length > 0 && (
                  <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {colorGroupKeys.length} color group{colorGroupKeys.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {onAdd && (
                <Button 
                  onClick={onAdd} 
                  className="group h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Plus className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  Add Product
                </Button>
              )}
            </div>
          </div>
          
          {/* Modern Search */}
          <div className="mt-6">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                placeholder="Search products by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="flex-1 p-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Select a category to view products'}
            </p>
            {onAdd && !searchTerm && (
              <Button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {colorGroupKeys.map((color) => (
              <div key={color} className="space-y-4">
                {/* Color Group Header */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: color.toLowerCase() === 'no color' ? 'transparent' : color.toLowerCase() }}
                    />
                    {color}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {colorGroups[color].length} product{colorGroups[color].length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Products in this color group - Simple List Layout */}
                <div className="space-y-2">
                  {colorGroups[color].map((product) => (
                    <div key={`${color}-${product.id}`} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      {/* Product Image */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-gray-400" />
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
                              className="absolute top-0 right-0 z-50"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  triggerImageUpload(product.id, e);
                                }}
                                disabled={uploadingImage === product.id}
                                className="bg-blue-500 hover:bg-blue-600 rounded-full p-1 text-white cursor-pointer transition-all duration-200 flex items-center justify-center w-5 h-5"
                              >
                                {uploadingImage === product.id ? (
                                  <div className="animate-spin rounded-full h-2 w-2 border-b border-white"></div>
                                ) : (
                                  <Camera className="h-2 w-2" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Product Name */}
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{product.name}</h3>
                          
                          {/* Colors and Sizes */}
                          <div className="flex gap-4 mt-1">
                            {product.colors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-gray-500">Colors:</span>
                                {product.colors.map((productColor, index) => (
                                  <Badge 
                                    key={index} 
                                    variant={productColor === color ? "default" : "secondary"} 
                                    className="text-xs"
                                  >
                                    {productColor}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            {product.sizes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-gray-500">Sizes:</span>
                                {product.sizes.map((size, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {size}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Pricing */}
                      <div className="text-right space-y-1">
                        <div className="text-sm">
                          <span className="text-gray-600">Selling: </span>
                          <span className="font-medium text-green-600">LKR {product.sellingPrice.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Billing: </span>
                          <span className="font-medium text-blue-600">LKR {product.billingPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGrid;