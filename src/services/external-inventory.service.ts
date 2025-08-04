import { supabase } from '@/integrations/supabase/client';

export interface ExternalInventoryItem {
  product_name: string;
  product_code: string | null;
  color: string; // Contains comma-separated values for consolidated view
  size: string; // Contains comma-separated values for consolidated view
  category: string | null;
  sub_category: string | null;
  matched_product_id: string | null; // Link to products table
  current_stock: number;
  total_stock_in: number;
  total_stock_out: number;
  avg_unit_price: number;
  transaction_count: number;
  variant_count?: number; // Number of color/size combinations
  last_transaction_date: string;
  first_transaction_date: string;
  sources?: string; // Comma-separated transaction sources
  transaction_types?: string; // Comma-separated transaction types
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'; // Calculated status
  total_value?: number; // current_stock * avg_unit_price
}

export interface ExternalInventoryTransaction {
  id: string;
  product_name: string;
  product_code: string | null;
  color: string;
  size: string;
  category: string | null;
  transaction_type: string;
  quantity: number;
  movement_type: string;
  reference_name: string | null;
  user_name: string | null;
  transaction_date: string;
  external_source: string | null;
  external_id: string | null;
  notes: string | null;
  agency_id: string;
}

export interface ExternalInventoryByType {
  product_name: string;
  color: string;
  size: string;
  transaction_type: string;
  net_quantity: number;
  transaction_count: number;
  avg_price: number;
  last_transaction: string;
}

export interface ExternalInventoryMetrics {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalTransactions: number;
}

export class ExternalInventoryService {
  
  // Helper method to calculate stock status
  private calculateStockStatus(currentStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (currentStock <= 0) return 'out_of_stock';
    if (currentStock <= 5) return 'low_stock';
    return 'in_stock';
  }

  // Find matching product in products table for consistent linking
  private async findMatchingProduct(productName: string, agencyId: string): Promise<{id: string, name: string, category: string, subCategory: string} | null> {
    try {
      // Method 1: Try exact name match first
      let { data, error } = await supabase
        .from('products')
        .select('id, name, category, sub_category')
        .eq('agency_id', agencyId)
        .ilike('name', productName)
        .limit(1);

      if (error) {
        console.error('Error finding matching product:', error);
        return null;
      }

      if (data && data.length > 0) {
        return {
          id: data[0].id,
          name: data[0].name,
          category: data[0].category || 'General',
          subCategory: data[0].sub_category || 'General'
        };
      }

      // Method 2: Try fuzzy matching (remove brackets and variations)
      const cleanProductName = productName.replace(/\[[^\]]*\]/g, '').trim();
      
      ({ data, error } = await supabase
        .from('products')
        .select('id, name, category, sub_category')
        .eq('agency_id', agencyId)
        .ilike('name', `%${cleanProductName}%`)
        .limit(1));

      if (error) {
        console.error('Error in fuzzy matching:', error);
        return null;
      }

      if (data && data.length > 0) {
        return {
          id: data[0].id,
          name: data[0].name,
          category: data[0].category || 'General',
          subCategory: data[0].sub_category || 'General'
        };
      }

      return null;
    } catch (error) {
      console.error('Error in findMatchingProduct:', error);
      return null;
    }
  }
  
  // Get stock summary for an agency
  async getStockSummary(agencyId: string, forceRefresh: boolean = false): Promise<ExternalInventoryItem[]> {
    // Add cache-busting parameter to ensure fresh data
    if (forceRefresh) {
      // Small delay to ensure database has processed recent changes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.buildStockSummaryFromTransactions(agencyId);
  }

  // Helper method to build stock summary from raw transactions
  private async buildStockSummaryFromTransactions(agencyId: string, filters?: { searchTerm?: string; category?: string }): Promise<ExternalInventoryItem[]> {
    let query = supabase
      .from('external_inventory_management')
      .select(`
        product_name,
        product_code,
        color,
        size,
        category,
        sub_category,
        matched_product_id,
        unit_price,
        quantity,
        transaction_date,
        external_source,
        transaction_type
      `)
      .eq('agency_id', agencyId);

    // Apply filters
    if (filters?.searchTerm) {
      query = query.ilike('product_name', `%${filters.searchTerm}%`);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data: transactions, error } = await query.order('product_name', { ascending: true });

    if (error) {
      console.error('Error fetching external inventory transactions:', error);
      throw error;
    }

    console.log(`🔍 Debug: Fetched ${transactions?.length || 0} transactions for agency ${agencyId}`);
    if (transactions && transactions.length > 0) {
      console.log('🔍 Debug: Sample transactions:', transactions.slice(0, 3));
    } else {
      console.log(`⚠️ Debug: No transactions found for agency ${agencyId} - this agency will show empty inventory`);
    }

    // Helper function to normalize and extract size from product name or size field
    const extractSize = (productName: string, sizeField: string): string => {
      // If size field is not "Default", use it
      if (sizeField && sizeField !== 'Default') {
        return sizeField.toUpperCase();
      }
      
      // Extract numeric sizes (28, 30, 32, 34, etc.)
      const numericSizeMatch = productName.match(/\s+(\d+)$/);
      if (numericSizeMatch) {
        return numericSizeMatch[1];
      }
      
      // Extract letter sizes (XS, S, M, L, XL, 2XL, 3XL, XXL, XXXL)
      const letterSizeMatch = productName.match(/\s+(XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i);
      if (letterSizeMatch) {
        return letterSizeMatch[1].toUpperCase();
      }
      
      // Handle patterns like "BRITNY-BLACK 2XL" where size might be after color
      const afterColorSizeMatch = productName.match(/-[A-Z]+\s+(XS|S|M|L|XL|2XL|3XL|XXL|XXXL|\d+)$/i);
      if (afterColorSizeMatch) {
        return afterColorSizeMatch[1].toUpperCase();
      }
      
      return 'Default';
    };

    // Helper function to normalize color
    const normalizeColor = (color: string, productName: string): string => {
      // If color field is not "Default", use it
      if (color && color !== 'Default') {
        // Normalize common color spelling variations
        return color.toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }
      
      // Extract color from product name patterns
      // Pattern 1: "PRODUCT-COLOR SIZE" (e.g., "SOLACE-BEIGH 28")
      const colorAfterDashMatch = productName.match(/-([A-Z]+)\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i);
      if (colorAfterDashMatch) {
        return colorAfterDashMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }
      
      // Pattern 2: "PRODUCT-COLOR" without size (e.g., "SHORTS-BLACK")
      const colorAfterDashNoSizeMatch = productName.match(/-([A-Z]+)$/i);
      if (colorAfterDashNoSizeMatch) {
        return colorAfterDashNoSizeMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }
      
      return 'Default';
    };

    // Helper function to normalize product code
    const normalizeProductCode = (productCode: string | null, productName: string): string | null => {
      if (productCode) {
        return productCode.toUpperCase();
      }
      
      // Extract product code from brackets in product name
      const codeMatch = productName.match(/\[([^\]]+)\]/);
      if (codeMatch) {
        return codeMatch[1].toUpperCase();
      }
      
      return null;
    };

    // Helper function to create normalized base product name
    const createBaseProductName = (productName: string): string => {
      // Remove product code in brackets
      let baseName = productName.replace(/^\[[^\]]+\]\s*/, '');
      
      // Remove color and size patterns
      // Pattern 1: Remove "-COLOR SIZE" at the end
      baseName = baseName.replace(/-[A-Z]+\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i, '');
      
      // Pattern 2: Remove just size at the end if no color pattern matched
      baseName = baseName.replace(/\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i, '');
      
      // Pattern 3: Remove just "-COLOR" at the end if no size
      baseName = baseName.replace(/-[A-Z]+$/i, '');
      
      return baseName.trim();
    };

    // Group transactions by product variant (name + normalized color + normalized size)
    const groupedData = new Map<string, any>();
    
    transactions?.forEach(transaction => {
      const normalizedColor = normalizeColor(transaction.color, transaction.product_name);
      const normalizedSize = extractSize(transaction.product_name, transaction.size);
      const normalizedCode = normalizeProductCode(transaction.product_code, transaction.product_name);
      const baseProductName = createBaseProductName(transaction.product_name);
      
      // Create grouping key using base name, color, and size for consistent consolidation
      const key = `${baseProductName}|${normalizedColor}|${normalizedSize}`;
      
      if (!groupedData.has(key)) {
        // Reconstruct display name with normalized values
        let displayName = baseProductName;
        if (normalizedSize !== 'Default') {
          displayName += ' ' + normalizedSize;
        }
        if (normalizedCode) {
          displayName = `[${normalizedCode}] ${displayName}`;
        }
        
        groupedData.set(key, {
          product_name: displayName,
          product_code: normalizedCode,
          color: normalizedColor,
          size: normalizedSize,
          category: transaction.category || 'General',
          sub_category: transaction.sub_category || 'General',
          matched_product_id: transaction.matched_product_id,
          current_stock: 0,
          total_stock_in: 0,
          total_stock_out: 0,
          transaction_count: 0,
          variant_count: 1,
          avg_unit_price: 0,
          last_transaction_date: transaction.transaction_date,
          first_transaction_date: transaction.transaction_date,
          sources: new Set(),
          transaction_types: new Set(),
          price_sum: 0,
          price_count: 0
        });
      }
      
      const item = groupedData.get(key)!;
      item.current_stock += transaction.quantity;
      item.transaction_count++;
      
      if (transaction.quantity > 0) {
        item.total_stock_in += transaction.quantity;
      } else {
        item.total_stock_out += Math.abs(transaction.quantity);
      }
      
      if (transaction.unit_price > 0) {
        item.price_sum += transaction.unit_price;
        item.price_count++;
        item.avg_unit_price = item.price_sum / item.price_count;
      }
      
      if (transaction.transaction_date > item.last_transaction_date) {
        item.last_transaction_date = transaction.transaction_date;
      }
      if (transaction.transaction_date < item.first_transaction_date) {
        item.first_transaction_date = transaction.transaction_date;
      }
      
      item.sources.add(transaction.external_source);
      item.transaction_types.add(transaction.transaction_type);
    });

    // Convert to array and clean up
    return Array.from(groupedData.values()).map(item => ({
      ...item,
      sources: Array.from(item.sources).join(', '),
      transaction_types: Array.from(item.transaction_types).join(', '),
      stock_status: this.calculateStockStatus(item.current_stock),
      total_value: item.current_stock * (item.avg_unit_price || 0)
    }));
  }

  // Get transaction history for an agency
  async getTransactionHistory(agencyId: string, limit: number = 50): Promise<ExternalInventoryTransaction[]> {
    const { data, error } = await supabase
      .from('external_inventory_transactions')
      .select('*')
      .eq('agency_id', agencyId)
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching external inventory transactions:', error);
      throw error;
    }

    return data || [];
  }

  // Get stock breakdown by transaction type
  async getStockByType(agencyId: string): Promise<ExternalInventoryByType[]> {
    const { data, error } = await supabase
      .from('external_inventory_by_type')
      .select('*')
      .eq('agency_id', agencyId)
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error fetching external inventory by type:', error);
      throw error;
    }

    return data || [];
  }

  // Get current stock for a specific product
  async getCurrentStock(
    agencyId: string, 
    productName: string, 
    color: string = 'Default', 
    size: string = 'Default'
  ): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_external_inventory_stock', {
        p_agency_id: agencyId,
        p_product_name: productName,
        p_color: color,
        p_size: size
      });

    if (error) {
      console.error('Error getting current stock:', error);
      return 0;
    }

    return data || 0;
  }

  // Calculate inventory metrics
  async getInventoryMetrics(agencyId: string): Promise<ExternalInventoryMetrics> {
    const stockSummary = await this.getStockSummary(agencyId);
    
    const totalItems = stockSummary.length;
    const totalValue = stockSummary.reduce((sum, item) => 
      sum + (item.current_stock * (item.avg_unit_price || 0)), 0
    );
    const lowStockItems = stockSummary.filter(item => 
      item.current_stock > 0 && item.current_stock <= 5 // Assuming 5 as low stock threshold
    ).length;
    const outOfStockItems = stockSummary.filter(item => 
      item.current_stock <= 0
    ).length;
    const totalTransactions = stockSummary.reduce((sum, item) => 
      sum + item.transaction_count, 0
    );

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      totalTransactions
    };
  }

  // Add stock adjustment with product matching
  async addStockAdjustment(
    agencyId: string,
    userName: string,
    productName: string,
    color: string,
    size: string,
    adjustmentQuantity: number, // Can be positive or negative
    reason: string,
    notes?: string
  ): Promise<void> {
    // Try to find matching product for consistency
    const matchedProduct = await this.findMatchingProduct(productName, agencyId);
    
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
        category: matchedProduct?.category || 'General',
        sub_category: matchedProduct?.subCategory || 'General',
        matched_product_id: matchedProduct?.id || null,
        transaction_type: 'adjustment',
        transaction_id: `ADJ-${Date.now()}`,
        quantity: adjustmentQuantity,
        reference_name: reason,
        agency_id: agencyId,
        user_name: userName,
        notes: notes || `Manual stock adjustment: ${reason}`,
        external_source: 'manual'
      });

    if (error) {
      console.error('Error adding stock adjustment:', error);
      throw error;
    }
  }

  // Add sale transaction (stock OUT) with product matching
  async addSaleTransaction(
    agencyId: string,
    userName: string,
    productName: string,
    color: string,
    size: string,
    quantity: number,
    customerName: string,
    invoiceNumber?: string,
    unitPrice?: number
  ): Promise<void> {
    // Try to find matching product for consistency
    const matchedProduct = await this.findMatchingProduct(productName, agencyId);
    
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
        unit_price: unitPrice || 0,
        category: matchedProduct?.category || 'General',
        sub_category: matchedProduct?.subCategory || 'General',
        matched_product_id: matchedProduct?.id || null,
        transaction_type: 'sale',
        transaction_id: invoiceNumber || `SALE-${Date.now()}`,
        quantity: -Math.abs(quantity), // Negative for stock OUT
        reference_name: customerName,
        agency_id: agencyId,
        user_name: userName,
        notes: `Sale to ${customerName}`,
        external_source: 'manual'
      });

    if (error) {
      console.error('Error adding sale transaction:', error);
      throw error;
    }
  }

  // Add return transaction (stock IN) with product matching
  async addReturnTransaction(
    agencyId: string,
    userName: string,
    productName: string,
    color: string,
    size: string,
    quantity: number,
    customerName: string,
    reason: string,
    originalInvoiceNumber?: string
  ): Promise<void> {
    // Try to find matching product for consistency
    const matchedProduct = await this.findMatchingProduct(productName, agencyId);
    
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
        category: matchedProduct?.category || 'General',
        sub_category: matchedProduct?.subCategory || 'General',
        matched_product_id: matchedProduct?.id || null,
        transaction_type: 'customer_return',
        transaction_id: `RET-${Date.now()}`,
        quantity: Math.abs(quantity), // Positive for stock IN
        reference_name: customerName,
        agency_id: agencyId,
        user_name: userName,
        notes: `Return from ${customerName}: ${reason}${originalInvoiceNumber ? ` (Original: ${originalInvoiceNumber})` : ''}`,
        external_source: 'manual',
        external_reference: originalInvoiceNumber
      });

    if (error) {
      console.error('Error adding return transaction:', error);
      throw error;
    }
  }

  // Search products by name
  async searchProducts(agencyId: string, searchTerm: string): Promise<ExternalInventoryItem[]> {
    return this.buildStockSummaryFromTransactions(agencyId, { searchTerm });
  }

  // Get products by category
  async getProductsByCategory(agencyId: string, category: string): Promise<ExternalInventoryItem[]> {
    return this.buildStockSummaryFromTransactions(agencyId, { category });
  }

  // Get unique subcategories for an agency
  async getCategories(agencyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('external_inventory_management')
      .select('sub_category')
      .eq('agency_id', agencyId)
      .not('sub_category', 'is', null);

    if (error) {
      console.error('Error getting subcategories:', error);
      throw error;
    }

    const categories = [...new Set(data?.map(item => item.sub_category).filter(Boolean))];
    return categories.sort();
  }
}

// Create singleton instance
export const externalInventoryService = new ExternalInventoryService();