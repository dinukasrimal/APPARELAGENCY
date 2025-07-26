import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Package, Image as ImageIcon, ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types/product';

interface Category {
  id: string;
  name: string;
  image?: string;
  subCategories: SubCategory[];
}

interface SubCategory {
  id: string;
  name: string;
  image?: string;
  categoryId: string;
}

interface ProductSidebarProps {
  onProductsFilter: (products: Product[]) => void;
  onCategorySelect?: (categoryId: string) => void;
  onSubCategorySelect?: (subCategoryId: string, categoryId: string) => void;
  onViewChange?: (view: 'categories' | 'subcategories' | 'products') => void;
  userRole?: 'agency' | 'superuser' | 'agent';
}

const ProductSidebar = ({ onProductsFilter, onCategorySelect, onSubCategorySelect, onViewChange, userRole }: ProductSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'categories' | 'subcategories' | 'products'>('categories');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  const fetchProductsAndCategories = async () => {
    try {
      setIsLoading(true);
      
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('category', { ascending: true });

      if (productsError) throw productsError;

      // Fetch category images (only if table exists)
      let categoryImagesData: any[] = [];
      try {
        const { data, error: categoryImagesError } = await supabase
          .from('category_images')
          .select('*');

        if (categoryImagesError) {
          console.warn('Category images table does not exist yet:', categoryImagesError.message);
          categoryImagesData = [];
        } else {
          categoryImagesData = data || [];
        }
      } catch (error) {
        console.warn('Category images table not found, skipping image fetch');
        categoryImagesData = [];
      }

      const formattedProducts: Product[] = productsData.map(product => ({
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

      // Create a map of category images for quick lookup
      const categoryImageMap = new Map<string, string>();
      categoryImagesData?.forEach(item => {
        const key = item.subcategory_name 
          ? `${item.category_name}-${item.subcategory_name}`
          : item.category_name;
        categoryImageMap.set(key, item.image_url);
      });

      // Group products by category and subcategory
      const categoriesMap = new Map<string, Category>();
      const subCategoriesMap = new Map<string, SubCategory[]>();

      formattedProducts.forEach(product => {
        const categoryName = product.category;
        const subCategoryName = product.subCategory || 'General';

        // Create category if not exists
        if (!categoriesMap.has(categoryName)) {
          categoriesMap.set(categoryName, {
            id: categoryName,
            name: categoryName,
            image: categoryImageMap.get(categoryName),
            subCategories: []
          });
          subCategoriesMap.set(categoryName, []);
        }

        // Create subcategory if not exists
        const existingSubCats = subCategoriesMap.get(categoryName) || [];
        if (!existingSubCats.some(sc => sc.name === subCategoryName)) {
          const subCategoryKey = `${categoryName}-${subCategoryName}`;
          existingSubCats.push({
            id: `${categoryName}-${subCategoryName}`,
            name: subCategoryName,
            image: categoryImageMap.get(subCategoryKey),
            categoryId: categoryName
          });
          subCategoriesMap.set(categoryName, existingSubCats);
        }
      });

      // Merge subcategories into categories
      const finalCategories: Category[] = Array.from(categoriesMap.values()).map(category => ({
        ...category,
        subCategories: subCategoriesMap.get(category.name) || []
      }));

      setCategories(finalCategories);
    } catch (error) {
      console.error('Error fetching products and categories:', error);
      toast({
        title: "Error",
        description: "Failed to load products and categories",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedSubCategory(null);
    setCurrentView('subcategories');
    onCategorySelect?.(categoryId);
    onViewChange?.("subcategories");
    
    // Filter products by category
    const categoryProducts = products.filter(p => p.category === categoryId);
    onProductsFilter(categoryProducts);
  };

  const handleSubCategoryClick = (subCategoryId: string, categoryId: string) => {
    setSelectedSubCategory(subCategoryId);
    setCurrentView('products');
    onSubCategorySelect?.(subCategoryId, categoryId);
    onViewChange?.("products");
    
    // Filter products by subcategory
    const subCategoryName = subCategoryId.split('-').slice(1).join('-');
    const filteredProducts = products.filter(p => 
      p.category === categoryId && 
      (p.subCategory === subCategoryName || (!p.subCategory && subCategoryName === 'General'))
    );
    onProductsFilter(filteredProducts);
  };

  const handleBackToSubcategories = () => {
    setSelectedSubCategory(null);
    setCurrentView('subcategories');
    onViewChange?.("subcategories");
    // Filter products by category when going back
    const categoryProducts = products.filter(p => p.category === selectedCategory);
    onProductsFilter(categoryProducts);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setCurrentView('categories');
    onViewChange?.("categories");
    onProductsFilter(products);
  };

  const handleImageUpload = async (file: File, type: 'category' | 'subcategory', id: string) => {
    try {
      console.log('Starting image upload:', { fileName: file.name, type, id });
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${id}-${Date.now()}.${fileExt}`;
      const filePath = `categories/${fileName}`;
      
      console.log('Uploading to path:', filePath);
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Handle common storage errors
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket not configured. Please contact administrator to set up image storage.');
        }
        throw uploadError;
      }

      console.log('File uploaded successfully to storage');

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;
      console.log('Generated public URL:', imageUrl);

      // Parse the category and subcategory from the id
      let categoryName: string;
      let subcategoryName: string | null = null;

      if (type === 'subcategory') {
        const parts = id.split('-');
        categoryName = parts[0];
        subcategoryName = parts.slice(1).join('-');
      } else {
        categoryName = id;
      }

      console.log('Saving to database:', { categoryName, subcategoryName, imageUrl });

      let dbSaveSuccessful = false;

      // Try to save image URL to database (handle table not existing)
      try {
        const { error: dbError } = await supabase
          .from('category_images')
          .upsert({
            category_name: categoryName,
            subcategory_name: subcategoryName,
            image_url: imageUrl
          }, {
            onConflict: 'category_name,subcategory_name'
          });

        if (dbError) {
          console.warn('Database save failed (table may not exist):', dbError.message);
        } else {
          console.log('Image URL saved to database successfully');
          dbSaveSuccessful = true;
        }
      } catch (dbError: any) {
        console.warn('Database save failed:', dbError?.message || dbError);
      }

      // Update the image URL in state
      if (type === 'category') {
        setCategories(prev => prev.map(cat => 
          cat.id === id ? { ...cat, image: imageUrl } : cat
        ));
      } else {
        setCategories(prev => prev.map(cat => ({
          ...cat,
          subCategories: cat.subCategories.map(subCat => 
            subCat.id === id ? { ...subCat, image: imageUrl } : subCat
          )
        })));
      }

      console.log('State updated with new image URL');

      // Show appropriate success message
      if (dbSaveSuccessful) {
        toast({
          title: "Success",
          description: "Image uploaded and saved successfully",
        });
      } else {
        toast({
          title: "Image Uploaded",
          description: "Image uploaded to storage. Create database table for persistence.",
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive"
      });
    }
  };

  const ImageUploadButton = ({ type, id, currentImage }: { type: 'category' | 'subcategory', id: string, currentImage?: string }) => {
    // Hide upload button for agency users
    if (userRole === 'agency') {
      return null;
    }

    const handleButtonClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Upload button clicked:', { type, id });
      
      // Create and trigger file input
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      
      fileInput.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        console.log('File selected via programmatic input:', file?.name);
        
        if (file) {
          handleImageUpload(file, type, id);
        }
        
        // Clean up
        document.body.removeChild(fileInput);
      };
      
      document.body.appendChild(fileInput);
      fileInput.click();
    };
    
    return (
      <Button
        type="button"
        variant={type === 'subcategory' ? 'default' : 'ghost'}
        size={type === 'subcategory' ? 'sm' : 'sm'}
        className={type === 'subcategory' 
          ? "bg-blue-600 hover:bg-blue-700 text-white relative z-50" 
          : "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity relative z-50"
        }
        onClick={handleButtonClick}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Upload className={type === 'subcategory' ? "h-4 w-4 mr-2" : "h-3 w-3"} />
        {type === 'subcategory' && (currentImage ? 'Change Image' : 'Upload Image')}
      </Button>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      {/* Top Categories Bar */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-center gap-4">
          {categories.map((category) => (
            <Card 
              key={category.id}
              className={`cursor-pointer transition-all duration-200 group hover:shadow-md ${
                selectedCategory === category.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleCategoryClick(category.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  {/* Category Image */}
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Category Details */}
                  <div>
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    <p className="text-xs text-gray-500">
                      {category.subCategories.length} subcategories
                    </p>
                  </div>
                  
                  {/* Upload Button - Only for non-agency users */}
                  {userRole !== 'agency' && (
                    <ImageUploadButton type="category" id={category.id} currentImage={category.image} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {currentView === 'subcategories' && selectedCategory && (
          <div className="p-6">
            {/* Back Button and Header */}
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                onClick={handleBackToCategories}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Categories
              </Button>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {categories.find(c => c.id === selectedCategory)?.name}
                </h3>
                <p className="text-sm text-gray-600">
                  Select a subcategory to view products
                </p>
              </div>
            </div>
            
            {/* Large Subcategory Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories.find(c => c.id === selectedCategory)?.subCategories.map((subCategory) => (
                <Card
                  key={subCategory.id}
                  className={`cursor-pointer transition-all duration-200 group hover:shadow-xl hover:scale-105 ${
                    selectedSubCategory === subCategory.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={(e) => {
                    // Don't navigate if clicking on upload button area
                    if ((e.target as HTMLElement).closest('.upload-button-area')) {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Click on upload area prevented navigation');
                      return;
                    }
                    handleSubCategoryClick(subCategory.id, selectedCategory);
                  }}
                >
                  <CardContent className="p-6">
                    {/* Extra Large Subcategory Image */}
                    <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden mb-6">
                      {subCategory.image ? (
                        <img
                          src={subCategory.image}
                          alt={subCategory.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-24 w-24 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Subcategory Details */}
                    <div className="text-center">
                      <h4 className="text-xl font-bold text-gray-900 mb-3">{subCategory.name}</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        {products.filter(p => 
                          p.category === selectedCategory && 
                          (p.subCategory === subCategory.name || (!p.subCategory && subCategory.name === 'General'))
                        ).length} products available
                      </p>
                      
                      {/* Upload Button */}
                      <div className="flex justify-center upload-button-area">
                        {userRole === 'agency' ? (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">
                              {subCategory.image ? 'Image uploaded' : 'No image available'}
                            </p>
                          </div>
                        ) : (
                          !subCategory.image ? (
                            <div className="text-center">
                              <ImageUploadButton type="subcategory" id={subCategory.id} currentImage={subCategory.image} />
                              <p className="text-xs text-gray-500 mt-2">Click to upload image</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <ImageUploadButton type="subcategory" id={subCategory.id} currentImage={subCategory.image} />
                              <p className="text-xs text-gray-500 mt-2">Click to change image</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentView === 'products' && selectedCategory && selectedSubCategory && (
          <div className="p-6">
            {/* Back Button and Header */}
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                onClick={handleBackToSubcategories}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Subcategories
              </Button>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {categories.find(c => c.id === selectedCategory)?.subCategories.find(sc => sc.id === selectedSubCategory)?.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {categories.find(c => c.id === selectedCategory)?.name} products
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSidebar;