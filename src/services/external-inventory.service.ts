import { supabase } from '@/integrations/supabase/client';

export interface ExternalInventoryItem {
  product_name: string;
  original_product_name?: string; // Original product name from external_inventory_management for matching
  product_code: string | null;
  color: string; // Contains comma-separated values for consolidated view
  size: string; // Contains comma-separated values for consolidated view
  category: string | null;
  sub_category: string | null;
  // matched_product_id removed - using direct relationship via product_name = products.description
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

  // No longer needed - using direct relationship via product_name = products.description
  
  // Get stock summary for a user based on their profile name matching reference_name
  async getStockSummary(userId: string, forceRefresh: boolean = false): Promise<ExternalInventoryItem[]> {
    // Add cache-busting parameter to ensure fresh data
    if (forceRefresh) {
      // Small delay to ensure database has processed recent changes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.buildStockSummaryFromTransactions(userId);
  }

  // Get all stock for an agency (superuser only) - no reference_name filtering
  async getAgencyStockSummary(agencyId: string, forceRefresh: boolean = false): Promise<ExternalInventoryItem[]> {
    if (forceRefresh) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.buildAgencyStockSummaryFromTransactions(agencyId);
  }

  // Helper method to build stock summary for entire agency (superuser only)
  private async buildAgencyStockSummaryFromTransactions(agencyId: string, filters?: { searchTerm?: string; category?: string }): Promise<ExternalInventoryItem[]> {
    console.log(`🔍 Debug: Getting ALL stock for agency ${agencyId} (superuser mode)`);

    // Get transactions first, then join with products table
    // Only include approved transactions in stock calculations
    let query = supabase
      .from('external_inventory_management')
      .select(`
        product_name,
        product_code,
        color,
        size,
        category,
        sub_category,
        unit_price,
        quantity,
        transaction_date,
        external_source,
        transaction_type,
        reference_name
      `)
      .eq('agency_id', agencyId)
      .eq('approval_status', 'approved'); // Only approved transactions affect stock

    // Apply filters
    if (filters?.searchTerm) {
      query = query.ilike('product_name', `%${filters.searchTerm}%`);
    }

    if (filters?.category) {
      query = query.eq('sub_category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching agency transactions:', error);
      throw error;
    }

    console.log(`🔍 Debug: Fetched ${data?.length || 0} transactions for agency ${agencyId}`);
    if (data && data.length > 0) {
      console.log(`🔍 Debug: Sample transactions:`, data.slice(0, 3));
    } else {
      console.log(`⚠️ Debug: No transactions found for agency ${agencyId} - this agency will show empty inventory`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get unique product names and fetch their corresponding products table data  
    const uniqueProductNames = [...new Set(data.map(item => item.product_name))];
    
    // Fetch products data for all unique product names
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('description, name, sub_category')
      .in('description', uniqueProductNames);

    if (productsError) {
      console.error('Error fetching products data:', productsError);
    }

    // Create a lookup map for products
    const productsMap = new Map();
    productsData?.forEach(product => {
      productsMap.set(product.description, {
        displayName: product.name,
        subCategory: product.sub_category
      });
    });

    // Helper function to normalize and extract size from product name or size field
    const extractSize = (productName: string, sizeField: string): string => {
      if (sizeField && sizeField !== 'Default') {
        return sizeField.toUpperCase();
      }
      
      const numericSizeMatch = productName.match(/\s+(\d+)$/);
      if (numericSizeMatch) {
        return numericSizeMatch[1];
      }
      
      const letterSizeMatch = productName.match(/\s+(XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i);
      if (letterSizeMatch) {
        return letterSizeMatch[1].toUpperCase();
      }
      
      const afterColorSizeMatch = productName.match(/-[A-Z]+\s+(XS|S|M|L|XL|2XL|3XL|XXL|XXXL|\d+)$/i);
      if (afterColorSizeMatch) {
        return afterColorSizeMatch[1].toUpperCase();
      }
      
      return 'Default';
    };

    // Helper function to normalize color
    const normalizeColor = (color: string, productName: string): string => {
      if (color && color !== 'Default') {
        return color.toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }
      
      const colorAfterDashMatch = productName.match(/-([A-Z]+)\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i);
      if (colorAfterDashMatch) {
        return colorAfterDashMatch[1].toUpperCase()
          .replace('BEIGH', 'BEIGE')
          .replace('GREY', 'GRAY');
      }
      
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
      
      const codeMatch = productName.match(/\[([^\]]+)\]/);
      if (codeMatch) {
        return codeMatch[1].toUpperCase();
      }
      
      return null;
    };

    // Helper function to create normalized base product name
    const createBaseProductName = (productName: string): string => {
      let baseName = productName.replace(/^\[[^\]]+\]\s*/, '');
      baseName = baseName.replace(/-[A-Z]+\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i, '');
      baseName = baseName.replace(/\s+(?:\d+|XS|S|M|L|XL|2XL|3XL|XXL|XXXL)$/i, '');
      baseName = baseName.replace(/-[A-Z]+$/i, '');
      return baseName.trim();
    };

    // Group transactions by product variant
    const groupedData = new Map<string, any>();
    
    data.forEach(transaction => {
      const normalizedColor = normalizeColor(transaction.color, transaction.product_name);
      const normalizedSize = extractSize(transaction.product_name, transaction.size);
      const normalizedCode = normalizeProductCode(transaction.product_code, transaction.product_name);
      
      // Get product info from products table
      const productInfo = productsMap.get(transaction.product_name);
      const displayName = productInfo?.displayName || transaction.product_name;
      const subCategory = productInfo?.subCategory || transaction.sub_category || 'General';
      
      const key = `${transaction.product_name}|${normalizedColor}|${normalizedSize}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          product_name: displayName, // Use products.name for display
          original_product_name: transaction.product_name, // Keep original for matching
          product_code: normalizedCode,
          color: normalizedColor,
          size: normalizedSize,
          category: transaction.category || 'General',
          sub_category: subCategory, // Use products.sub_category
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

  // Helper method to build stock summary from raw transactions filtered by user profile name  
  private async buildStockSummaryFromTransactions(userId: string, filters?: { searchTerm?: string; category?: string }): Promise<ExternalInventoryItem[]> {
    // First get the user's profile name
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('name, agency_id')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Error getting user profile:', profileError);
      return [];
    }

    const userProfileName = profileData.name;
    const agencyId = profileData.agency_id;
    
    if (!userProfileName) {
      console.warn('User profile has no name');
      return [];
    }

    console.log(`🔍 Debug: Looking for inventory where reference_name matches "${userProfileName}" for agency ${agencyId}`);

    let query = supabase
      .from('external_inventory_management')
      .select(`
        product_name,
        product_code,
        color,
        size,
        category,
        sub_category,
        unit_price,
        quantity,
        transaction_date,
        external_source,
        transaction_type,
        reference_name
      `)
      .eq('agency_id', agencyId)
      .eq('reference_name', userProfileName) // Filter by user's profile name
      .eq('approval_status', 'approved'); // Only approved transactions affect stock

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
      
      // Debug: Check for recent BRITNY-BLACK L transactions
      const britnyTransactions = transactions.filter(t => 
        t.product_name?.includes('BRITNY') && t.color === 'BLACK' && t.size === 'L'
      );
      console.log('🔍 Debug: BRITNY-BLACK L transactions:', britnyTransactions);
      
      // Debug: Check for sale transactions
      const saleTransactions = transactions.filter(t => t.transaction_type === 'sale');
      console.log('🔍 Debug: Sale transactions found:', saleTransactions.length);
      if (saleTransactions.length > 0) {
        console.log('🔍 Debug: Sample sale transactions:', saleTransactions.slice(-3));
      }
    } else {
      console.log(`⚠️ Debug: No transactions found for agency ${agencyId} - this agency will show empty inventory`);
    }

    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Get unique product names and fetch their corresponding products table data  
    const uniqueProductNames = [...new Set(transactions.map(item => item.product_name))];
    
    // Fetch products data for all unique product names
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('description, name, sub_category')
      .in('description', uniqueProductNames);

    if (productsError) {
      console.error('Error fetching products data:', productsError);
    }

    // Create a lookup map for products
    const productsMap = new Map();
    productsData?.forEach(product => {
      productsMap.set(product.description, {
        displayName: product.name,
        subCategory: product.sub_category
      });
    });

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
      
      // Get product info from products table
      const productInfo = productsMap.get(transaction.product_name);
      const displayName = productInfo?.displayName || transaction.product_name;
      const subCategory = productInfo?.subCategory || transaction.sub_category || 'General';
      
      const key = `${transaction.product_name}|${normalizedColor}|${normalizedSize}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          product_name: displayName, // Use products.name for display
          original_product_name: transaction.product_name, // Keep original for matching
          product_code: normalizedCode,
          color: normalizedColor,
          size: normalizedSize,
          category: transaction.category || 'General',
          sub_category: subCategory, // Use products.sub_category
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
      
      // Debug specific product
      if (transaction.product_name?.includes('BRITNY') && normalizedColor === 'BLACK' && normalizedSize === 'L') {
        console.log('🔍 Debug: Processing BRITNY-BLACK L transaction:', {
          type: transaction.transaction_type,
          quantity: transaction.quantity,
          currentStock: item.current_stock,
          newStock: item.current_stock + transaction.quantity,
          transactionDate: transaction.transaction_date,
          key: key
        });
      }
      
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
    const result = Array.from(groupedData.values()).map(item => ({
      ...item,
      sources: Array.from(item.sources).join(', '),
      transaction_types: Array.from(item.transaction_types).join(', '),
      stock_status: this.calculateStockStatus(item.current_stock),
      total_value: item.current_stock * (item.avg_unit_price || 0)
    }));
    
    // Debug: Check final BRITNY-BLACK L result for user-specific function
    const britnyResult = result.find(item => 
      item.product_name?.includes('BRITNY') && item.color === 'BLACK' && item.size === 'L'
    );
    if (britnyResult) {
      console.log('🔍 Debug: Final USER-SPECIFIC BRITNY-BLACK L stock result:', britnyResult);
    }
    
    return result;
  }

  // Get transaction history for an agency (include all statuses for history)
  async getTransactionHistory(agencyId: string, limit: number = 50): Promise<ExternalInventoryTransaction[]> {
    const { data, error } = await supabase
      .from('external_inventory_management')
      .select(`
        id,
        product_name,
        product_code,
        color,
        size,
        category,
        sub_category,
        unit_price,
        quantity,
        transaction_date,
        external_source,
        transaction_type,
        reference_name,
        approval_status,
        user_name,
        notes
      `)
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

  // Get current stock for a specific product (only approved transactions)
  async getCurrentStock(
    agencyId: string, 
    productName: string, 
    color: string = 'Default', 
    size: string = 'Default'
  ): Promise<number> {
    const { data, error } = await supabase
      .from('external_inventory_management')
      .select('quantity')
      .eq('agency_id', agencyId)
      .eq('product_name', productName)
      .eq('color', color)
      .eq('size', size)
      .eq('approval_status', 'approved'); // Only approved transactions

    if (error) {
      console.error('Error getting current stock:', error);
      return 0;
    }

    const totalStock = data?.reduce((sum, row) => sum + row.quantity, 0) || 0;
    return totalStock;
  }

  // Calculate inventory metrics for user
  async getInventoryMetrics(userId: string): Promise<ExternalInventoryMetrics> {
    const stockSummary = await this.getStockSummary(userId);
    
    const totalItems = stockSummary.length;
    const totalValue = stockSummary.reduce((sum, item) => 
      sum + (item.current_stock * (item.avg_unit_price || 0)), 0
    );
    const lowStockItems = stockSummary.filter(item => 
      item.current_stock > 0 && item.current_stock <= 5
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

  // Calculate inventory metrics for agency (superuser)
  async getAgencyInventoryMetrics(agencyId: string): Promise<ExternalInventoryMetrics> {
    const stockSummary = await this.getAgencyStockSummary(agencyId);
    
    const totalItems = stockSummary.length;
    const totalValue = stockSummary.reduce((sum, item) => 
      sum + (item.current_stock * (item.avg_unit_price || 0)), 0
    );
    const lowStockItems = stockSummary.filter(item => 
      item.current_stock > 0 && item.current_stock <= 5
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
    // No product matching needed - using direct relationship via product_name/description
    const matchedProduct = null;
    
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
    console.log('🔄 addSaleTransaction called with:', {
      agencyId,
      userName,
      productName,
      color,
      size,
      quantity,
      customerName,
      invoiceNumber,
      unitPrice
    });
    
    // No product matching needed - using direct relationship via product_name/description
    const matchedProduct = null;
    
    // Try to match the product name format used by external bot sync
    // External bot uses format like "[BBL] BRITNY-BLACK L"
    // We need to find the correct product code and format
    let formattedProductName = productName;
    
    // Check if we can find a matching product with a code
    const { data: matchingProducts } = await supabase
      .from('external_inventory_management')
      .select('product_name, product_code')
      .ilike('product_name', `%${productName.replace(/\s+/g, '%')}%`)
      .not('product_code', 'is', null)
      .limit(1);
    
    if (matchingProducts && matchingProducts.length > 0) {
      formattedProductName = matchingProducts[0].product_name;
      console.log('🔄 Using existing product name format:', formattedProductName);
    }
    
    // Use 'Default' for color and size to match external bot format
    const transactionData = {
      product_name: formattedProductName,
      color: 'Default',
      size: 'Default',
      unit_price: unitPrice || 0,
      category: matchedProduct?.category || 'General',
      sub_category: matchedProduct?.subCategory || 'General',
      matched_product_id: matchedProduct?.id || null,
      transaction_type: 'sale',
      transaction_id: invoiceNumber || `SALE-${Date.now()}`,
      quantity: -Math.abs(quantity), // Negative for stock OUT
      reference_name: userName, // Use userName so it appears in user's inventory
      agency_id: agencyId,
      user_name: userName,
      notes: `Sale to ${customerName} (Invoice: ${invoiceNumber})`,
      external_source: 'manual'
    };
    
    console.log('📦 Inserting transaction data:', transactionData);
    
    const { error, data } = await supabase
      .from('external_inventory_management')
      .insert(transactionData)
      .select();

    if (error) {
      console.error('❌ Error adding sale transaction:', error);
      throw error;
    }
    
    console.log('✅ Sale transaction created:', data);
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
    // No product matching needed - using direct relationship via product_name/description
    const matchedProduct = null;
    
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
        reference_name: userName, // Use userName so it appears in user's inventory
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

  // Search products by name for user
  async searchProducts(userId: string, searchTerm: string): Promise<ExternalInventoryItem[]> {
    return this.buildStockSummaryFromTransactions(userId, { searchTerm });
  }

  // Get products by category for user
  async getProductsByCategory(userId: string, category: string): Promise<ExternalInventoryItem[]> {
    return this.buildStockSummaryFromTransactions(userId, { category });
  }

  // Get unique subcategories for a user from products table via direct relationship
  async getCategories(userId: string): Promise<string[]> {
    try {
      // First get the user's profile name
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, agency_id')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        console.error('Error getting user profile:', profileError);
        return [];
      }

      const userProfileName = profileData.name;
      const agencyId = profileData.agency_id;

      if (!userProfileName) {
        console.warn('User profile has no name');
        return [];
      }

      // Get unique product names from external inventory where reference_name matches user profile name
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('external_inventory_management')
        .select('product_name')
        .eq('agency_id', agencyId)
        .eq('reference_name', userProfileName);

      if (inventoryError) {
        console.error('Error getting inventory product names:', inventoryError);
        throw inventoryError;
      }

      if (!inventoryData || inventoryData.length === 0) {
        return [];
      }

      const productNames = [...new Set(inventoryData.map(item => item.product_name))];

      // Get subcategories from products table where description matches product names
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('sub_category')
        .in('description', productNames)
        .not('sub_category', 'is', null);

      if (productsError) {
        console.error('Error getting subcategories from products:', productsError);
        throw productsError;
      }

      const categories = [...new Set(productsData?.map(item => item.sub_category).filter(Boolean))];
      return categories.sort();
    } catch (error) {
      console.error('Error in getCategories:', error);
      throw error;
    }
  }

  // Get unique subcategories for an agency (superuser mode) - no reference_name filtering
  async getAgencyCategories(agencyId: string): Promise<string[]> {
    try {
      console.log(`🔍 Debug: Getting categories for agency ${agencyId} (superuser mode)`);

      // Get unique product names from external inventory for the entire agency
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('external_inventory_management')
        .select('product_name')
        .eq('agency_id', agencyId);

      if (inventoryError) {
        console.error('Error getting agency inventory product names:', inventoryError);
        throw inventoryError;
      }

      if (!inventoryData || inventoryData.length === 0) {
        return [];
      }

      const productNames = [...new Set(inventoryData.map(item => item.product_name))];

      // Get subcategories from products table where description matches product names
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('sub_category')
        .in('description', productNames)
        .not('sub_category', 'is', null);

      if (productsError) {
        console.error('Error getting subcategories from products:', productsError);
        throw productsError;
      }

      const categories = [...new Set(productsData?.map(item => item.sub_category).filter(Boolean))];
      return categories.sort();
    } catch (error) {
      console.error('Error in getAgencyCategories:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const externalInventoryService = new ExternalInventoryService();