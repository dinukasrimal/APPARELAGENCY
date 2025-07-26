
export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  colors: string[];
  sizes: string[];
  sellingPrice: number; // For sales orders
  billingPrice: number; // For purchase orders
  image?: string;
  description?: string;
}

export interface ProductVariant {
  productId: string;
  color: string;
  size: string;
  sku: string;
  sellingPrice: number;
  billingPrice: number;
}
