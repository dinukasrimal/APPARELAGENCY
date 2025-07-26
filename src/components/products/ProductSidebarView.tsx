import { useState, useRef, useEffect } from 'react';
import { User } from '@/types/auth';
import { Product } from '@/types/product';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProductSidebar from './ProductSidebar';
import ProductGrid from './ProductGrid';
import ProductForm from './ProductForm';

interface ProductSidebarViewProps {
  user: User;
}

const ProductSidebarView = ({ user }: ProductSidebarViewProps) => {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'categories' | 'subcategories' | 'products'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const sidebarRef = useRef<any>(null);
  const { toast } = useToast();

  const handleProductsFilter = (products: Product[]) => {
    setFilteredProducts(products);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedSubCategory(null);
    setCurrentView('subcategories');
  };

  const handleSubCategorySelect = (subCategoryId: string, categoryId: string) => {
    setSelectedSubCategory(subCategoryId);
    setCurrentView('products');
  };

  const handleViewChange = (view: 'categories' | 'subcategories' | 'products') => {
    setCurrentView(view);
  };

  // Listen for navigation state changes from ProductSidebar
  useEffect(() => {
    // This effect will help sync the view state if needed
  }, [selectedCategory, selectedSubCategory]);

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      setIsLoading(true);
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
      // Force refresh by re-triggering the sidebar fetch
      window.location.reload();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProduct = async (productData: Omit<Product, 'id'>) => {
    if (!editingProduct) return;

    try {
      setIsLoading(true);
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
      // Force refresh by re-triggering the sidebar fetch
      window.location.reload();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      // Remove from filtered products
      setFilteredProducts(prev => prev.filter(p => p.id !== productId));
      // Force refresh by re-triggering the sidebar fetch
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setShowCreateForm(true);
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setShowCreateForm(true);
  };

  const handleCancelForm = () => {
    setShowCreateForm(false);
    setEditingProduct(null);
  };

  if (showCreateForm) {
    return (
      <ProductForm
        product={editingProduct || undefined}
        onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}
        onCancel={handleCancelForm}
        userRole={user.role}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProductSidebar
        ref={sidebarRef}
        onProductsFilter={handleProductsFilter}
        onCategorySelect={handleCategorySelect}
        onSubCategorySelect={handleSubCategorySelect}
        onViewChange={handleViewChange}
        userRole={user.role}
      />
      
      {/* Render ProductGrid only when in products view */}
      {currentView === 'products' && (
        <ProductGrid
          products={filteredProducts}
          user={user}
          onAdd={handleAddClick}
          onProductUpdate={() => {
            // Force refresh by re-triggering the sidebar fetch
            if (sidebarRef.current) {
              sidebarRef.current.refreshProducts();
            }
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default ProductSidebarView;