
import { useState } from 'react';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, X, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProductImageUpload from './ProductImageUpload';

interface ProductFormProps {
  product?: Product;
  onSubmit: (productData: Omit<Product, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  userRole?: 'agency' | 'superuser' | 'agent';
}

const CATEGORIES = [
  'Apparel',
  'Footwear',
  'Accessories',
  'Home & Living',
  'Sports & Fitness',
  'Electronics',
  'Beauty & Personal Care',
  'Books & Stationery',
  'Toys & Games',
  'Automotive',
  'Health & Wellness'
];

const ProductForm = ({ product, onSubmit, onCancel, userRole }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    subCategory: product?.subCategory || '',
    sellingPrice: product?.sellingPrice || 0,
    billingPrice: product?.billingPrice || 0,
    image: product?.image || null
  });

  const [colors, setColors] = useState<string[]>(product?.colors || []);
  const [sizes, setSizes] = useState<string[]>(product?.sizes || []);
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const addColor = () => {
    if (newColor.trim() && !colors.includes(newColor.trim())) {
      setColors([...colors, newColor.trim()]);
      setNewColor('');
    }
  };

  const removeColor = (color: string) => {
    setColors(colors.filter(c => c !== color));
  };

  const addSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      setSizes([...sizes, newSize.trim()]);
      setNewSize('');
    }
  };

  const removeSize = (size: string) => {
    setSizes(sizes.filter(s => s !== size));
  };

  const handleImageUpdate = (imageUrl: string | null) => {
    setFormData({ ...formData, image: imageUrl });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      // Prevent event bubbling
      event.stopPropagation();
      
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file (JPG, PNG, GIF, WebP).');
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
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
      setFormData({ ...formData, image: imageUrl });

      toast({
        title: "Success",
        description: "Product image uploaded successfully",
      });

    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset the input value to allow re-uploading the same file
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image: null });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData = {
      ...formData,
      colors,
      sizes
    };

    onSubmit(productData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <p className="text-gray-600">
            {product ? 'Update product details' : 'Add a new product to your catalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="subCategory">Sub Category</Label>
                <Input
                  id="subCategory"
                  value={formData.subCategory}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing and Image */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sellingPrice">Selling Price (RS) *</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="billingPrice">Billing Price (RS) *</Label>
                <Input
                  id="billingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.billingPrice}
                  onChange={(e) => setFormData({ ...formData, billingPrice: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-4">
                <Label>Product Image</Label>
                
                {formData.image ? (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                    <img 
                      src={formData.image} 
                      alt="Product preview" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 p-1 h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      disabled={uploading}
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : formData.image ? 'Change Image' : 'Upload Image'}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Supported formats: JPG, PNG, GIF. Max size: 5MB
                </p>
              </div>
              
              {product && (
                <ProductImageUpload
                  productId={product.id}
                  currentImage={formData.image}
                  onImageUpdate={handleImageUpdate}
                  userRole={userRole}
                />
              )}
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Available Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
                />
                <Button type="button" onClick={addColor}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <Badge key={color} variant="secondary" className="flex items-center gap-1">
                    {color}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeColor(color)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sizes */}
          <Card>
            <CardHeader>
              <CardTitle>Available Sizes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add size"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                />
                <Button type="button" onClick={addSize}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <Badge key={size} variant="secondary" className="flex items-center gap-1">
                    {size}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeSize(size)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={!formData.name || !formData.category}>
            {product ? 'Update Product' : 'Add Product'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
