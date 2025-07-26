
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductImageUploadProps {
  productId: string;
  currentImage?: string;
  onImageUpdate: (imageUrl: string | null) => void;
  userRole?: 'agency' | 'superuser' | 'agent';
}

const ProductImageUpload = ({ productId, currentImage, onImageUpdate, userRole }: ProductImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(currentImage || null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      // Prevent event bubbling to parent elements
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
      const fileName = `${productId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
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
        .eq('id', productId);

      if (updateError) {
        throw updateError;
      }

      setImagePreview(imageUrl);
      onImageUpdate(imageUrl);

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

  const handleRemoveImage = async () => {
    try {
      setUploading(true);

      // Update product in database to remove image
      const { error: updateError } = await supabase
        .from('products')
        .update({ image: null })
        .eq('id', productId);

      if (updateError) {
        throw updateError;
      }

      // If there was a previous image, try to delete it from storage
      if (currentImage && currentImage.includes('product-images')) {
        const filePath = currentImage.split('/').pop();
        if (filePath) {
          await supabase.storage
            .from('product-images')
            .remove([`products/${filePath}`]);
        }
      }

      setImagePreview(null);
      onImageUpdate(null);

      toast({
        title: "Success",
        description: "Product image removed successfully",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Hide upload functionality for agency users
  if (userRole === 'agency') {
    return (
      <div className="space-y-4">
        <Label>Product Image (Optional)</Label>
        
        {imagePreview ? (
          <div className="w-32 h-32 border rounded-lg overflow-hidden">
            <img 
              src={imagePreview} 
              alt="Product preview" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        )}

        <p className="text-xs text-gray-500">
          Image uploads are restricted for agency users
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label>Product Image (Optional)</Label>
      
      {imagePreview ? (
        <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
          <img 
            src={imagePreview} 
            alt="Product preview" 
            className="w-full h-full object-cover"
          />
          <Button
            size="sm"
            variant="destructive"
            className="absolute top-1 right-1 p-1 h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            disabled={uploading}
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
            variant="outline" 
            disabled={uploading}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : imagePreview ? 'Change Image' : 'Upload Image'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Supported formats: JPG, PNG, GIF. Max size: 5MB
      </p>
    </div>
  );
};

export default ProductImageUpload;
