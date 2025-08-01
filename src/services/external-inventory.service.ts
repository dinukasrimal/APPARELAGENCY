import { supabase } from '@/integrations/supabase/client';

export interface ExternalInventoryItem {
  product_name: string;
  product_code: string | null;
  color: string;
  size: string;
  category: string | null;
  sub_category: string | null;
  current_stock: number;
  total_stock_in: number;
  total_stock_out: number;
  avg_unit_price: number;
  transaction_count: number;
  last_transaction_date: string;
  first_transaction_date: string;
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
  
  // Get stock summary for an agency
  async getStockSummary(agencyId: string): Promise<ExternalInventoryItem[]> {
    const { data, error } = await supabase
      .from('external_inventory_stock_summary')
      .select('*')
      .eq('agency_id', agencyId)
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error fetching external inventory stock summary:', error);
      throw error;
    }

    return data || [];
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

  // Add stock adjustment
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
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
        category: 'Manual Adjustment',
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

  // Add sale transaction (stock OUT)
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
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
        unit_price: unitPrice || 0,
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

  // Add return transaction (stock IN)
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
    const { error } = await supabase
      .from('external_inventory_management')
      .insert({
        product_name: productName,
        color: color,
        size: size,
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
    const { data, error } = await supabase
      .from('external_inventory_stock_summary')
      .select('*')
      .eq('agency_id', agencyId)
      .ilike('product_name', `%${searchTerm}%`)
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error searching products:', error);
      throw error;
    }

    return data || [];
  }

  // Get products by category
  async getProductsByCategory(agencyId: string, category: string): Promise<ExternalInventoryItem[]> {
    const { data, error } = await supabase
      .from('external_inventory_stock_summary')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('category', category)
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error getting products by category:', error);
      throw error;
    }

    return data || [];
  }

  // Get unique categories for an agency
  async getCategories(agencyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('external_inventory_stock_summary')
      .select('category')
      .eq('agency_id', agencyId)
      .not('category', 'is', null);

    if (error) {
      console.error('Error getting categories:', error);
      throw error;
    }

    const categories = [...new Set(data?.map(item => item.category).filter(Boolean))];
    return categories.sort();
  }
}

// Create singleton instance
export const externalInventoryService = new ExternalInventoryService();