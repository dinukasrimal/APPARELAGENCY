import { supabase } from '@/integrations/supabase/client';
import { performanceService } from './performance.service';
import { User } from '@/types/auth';

interface QueryOptions {
  cacheKey?: string;
  cacheTTL?: number;
  limit?: number;
  offset?: number;
}

class OptimizedDataService {
  
  // Optimized inventory data fetching
  async getInventoryData(user: User, options: QueryOptions = {}) {
    const endMeasurement = performanceService.startMeasurement('inventory-fetch');
    const cacheKey = options.cacheKey || `inventory-${user.id}-${user.role}-${user.agencyId}`;
    
    // Check cache first
    const cached = performanceService.getCache(cacheKey);
    if (cached) {
      endMeasurement();
      return cached;
    }

    try {
      // Build role-based inventory query with optimized fields
      let inventoryQuery = supabase
        .from('inventory_items')
        .select(`
          id, product_id, product_name, color, size,
          current_stock, minimum_stock, agency_id, last_updated
        `);

      // Apply role-based filtering
      if (user.role === 'agent' || user.role === 'agency') {
        inventoryQuery = inventoryQuery.eq('agency_id', user.agencyId);
      }

      // Apply pagination and limits
      const limit = options.limit || 200;
      inventoryQuery = inventoryQuery
        .order('last_updated', { ascending: false })
        .limit(limit);

      if (options.offset) {
        inventoryQuery = inventoryQuery.range(options.offset, options.offset + limit - 1);
      }

      const { data: inventoryData, error: inventoryError } = await inventoryQuery;
      
      if (inventoryError) throw inventoryError;

      // Batch fetch product details
      const productIds = [...new Set(inventoryData?.map(item => item.product_id).filter(Boolean) || [])];
      const productDetails = new Map();
      
      if (productIds.length > 0) {
        // Batch query for product details
        const { data: productsData } = await supabase
          .from('products')
          .select('id, category, sub_category, selling_price')
          .in('id', productIds);
        
        if (productsData) {
          productsData.forEach(product => {
            productDetails.set(product.id, product);
          });
        }
      }

      // Transform data efficiently
      const transformedItems = inventoryData?.map(item => {
        const product = productDetails.get(item.product_id);
        return {
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          category: product?.category || 'Unknown',
          subCategory: product?.sub_category || '',
          color: item.color,
          size: item.size,
          currentStock: item.current_stock,
          minStockLevel: item.minimum_stock || 0,
          unitPrice: product?.selling_price || 0,
          agencyId: item.agency_id,
          lastUpdated: new Date(item.last_updated)
        };
      }) || [];

      // Cache the result
      performanceService.setCache(cacheKey, transformedItems, options.cacheTTL);
      
      endMeasurement();
      return transformedItems;

    } catch (error) {
      endMeasurement();
      console.error('Error fetching inventory data:', error);
      throw error;
    }
  }

  // Optimized sales data fetching with parallel queries
  async getSalesData(user: User, options: QueryOptions = {}) {
    const endMeasurement = performanceService.startMeasurement('sales-fetch');
    const cacheKey = options.cacheKey || `sales-${user.id}-${user.role}-${user.agencyId}`;
    
    // Check cache first
    const cached = performanceService.getCache(cacheKey);
    if (cached) {
      endMeasurement();
      return cached;
    }

    try {
      // Prepare parallel queries
      const queries = [];
      
      // Optimized sales orders query
      let ordersQuery = supabase
        .from('sales_orders')
        .select(`
          id, customer_id, customer_name, agency_id, subtotal, 
          discount_percentage, discount_amount, total, total_invoiced,
          status, requires_approval, approved_by, approved_at,
          latitude, longitude, created_at, created_by
        `);
      
      if (user.role === 'agent') {
        ordersQuery = ordersQuery.eq('created_by', user.id);
      } else if (user.role === 'agency') {
        ordersQuery = ordersQuery.eq('agency_id', user.agencyId);
      }
      
      queries.push(ordersQuery.order('created_at', { ascending: false }).limit(100));
      
      // Sales order items query
      queries.push(
        supabase
          .from('sales_order_items')
          .select('id, sales_order_id, product_id, product_name, color, size, quantity, unit_price, total')
      );

      // Optimized invoices query
      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          id, sales_order_id, customer_id, customer_name, agency_id,
          subtotal, discount_amount, total, latitude, longitude,
          signature, created_at, created_by
        `);
      
      if (user.role === 'agent') {
        invoicesQuery = invoicesQuery.eq('created_by', user.id);
      } else if (user.role === 'agency') {
        invoicesQuery = invoicesQuery.eq('agency_id', user.agencyId);
      }
      
      queries.push(invoicesQuery.order('created_at', { ascending: false }).limit(100));
      
      // Invoice items query
      queries.push(
        supabase
          .from('invoice_items')
          .select('id, invoice_id, product_id, product_name, color, size, quantity, unit_price, total')
      );

      // Execute all queries in parallel
      const [ordersResult, itemsResult, invoicesResult, invoiceItemsResult] = await Promise.all(queries);
      
      if (ordersResult.error) throw ordersResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (invoiceItemsResult.error) throw invoiceItemsResult.error;

      // Transform orders with items
      const transformedOrders = (ordersResult.data || []).map(order => {
        const orderItems = (itemsResult.data || []).filter(item => item.sales_order_id === order.id);
        
        return {
          id: order.id,
          orderNumber: order.id,
          customerId: order.customer_id,
          customerName: order.customer_name,
          agencyId: order.agency_id,
          items: orderItems.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            total: Number(item.total)
          })),
          subtotal: Number(order.subtotal),
          discountPercentage: Number(order.discount_percentage),
          discountAmount: Number(order.discount_amount),
          total: Number(order.total),
          totalInvoiced: Number(order.total_invoiced || 0),
          status: order.status,
          requiresApproval: order.requires_approval,
          approvedBy: order.approved_by,
          approvedAt: order.approved_at ? new Date(order.approved_at) : undefined,
          gpsCoordinates: {
            latitude: order.latitude || 0,
            longitude: order.longitude || 0
          },
          createdAt: new Date(order.created_at),
          createdBy: order.created_by
        };
      });

      // Transform invoices with items
      const transformedInvoices = (invoicesResult.data || []).map(invoice => {
        const invoiceItems = (invoiceItemsResult.data || []).filter(item => item.invoice_id === invoice.id);
        
        return {
          id: invoice.id,
          invoiceNumber: invoice.id,
          salesOrderId: invoice.sales_order_id,
          customerId: invoice.customer_id,
          customerName: invoice.customer_name,
          agencyId: invoice.agency_id,
          items: invoiceItems.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            total: Number(item.total)
          })),
          subtotal: Number(invoice.subtotal),
          discountAmount: Number(invoice.discount_amount),
          total: Number(invoice.total),
          gpsCoordinates: {
            latitude: invoice.latitude || 0,
            longitude: invoice.longitude || 0
          },
          signature: invoice.signature,
          createdAt: new Date(invoice.created_at),
          createdBy: invoice.created_by
        };
      });

      const result = {
        orders: transformedOrders,
        invoices: transformedInvoices
      };

      // Cache the result
      performanceService.setCache(cacheKey, result, options.cacheTTL);
      
      endMeasurement();
      return result;

    } catch (error) {
      endMeasurement();
      console.error('Error fetching sales data:', error);
      throw error;
    }
  }

  // Optimized stock movements with aggregation
  async getStockMovements(user: User, options: QueryOptions = {}) {
    const endMeasurement = performanceService.startMeasurement('stock-movements-fetch');
    const cacheKey = options.cacheKey || `stock-movements-${user.id}-${user.role}-${user.agencyId}`;
    
    // Check cache first
    const cached = performanceService.getCache(cacheKey);
    if (cached) {
      endMeasurement();
      return cached;
    }

    try {
      let movementsQuery = supabase
        .from('inventory_transactions')
        .select(`
          id, product_name, color, size, transaction_type, quantity,
          reference_name, created_at, external_product_name, external_product_category
        `)
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

      if (user.role === 'agent' || user.role === 'agency') {
        movementsQuery = movementsQuery.eq('agency_id', user.agencyId);
      }

      const { data: movementsData, error: movementsError } = await movementsQuery;
      
      if (movementsError) throw movementsError;

      const movements = (movementsData || []).map(movement => ({
        id: movement.id,
        productName: movement.product_name,
        color: movement.color,
        size: movement.size,
        transactionType: movement.transaction_type,
        quantity: movement.quantity,
        referenceName: movement.reference_name,
        createdAt: movement.created_at,
        externalProductName: movement.external_product_name,
        externalProductCategory: movement.external_product_category
      }));

      // Cache the result
      performanceService.setCache(cacheKey, movements, options.cacheTTL);
      
      endMeasurement();
      return movements;

    } catch (error) {
      endMeasurement();
      console.error('Error fetching stock movements:', error);
      throw error;
    }
  }

  // Clear cache for specific patterns
  clearCache(pattern: string) {
    performanceService.clearCache(pattern);
  }

  // Get performance metrics
  getPerformanceReport() {
    return performanceService.getPerformanceReport();
  }
}

export const optimizedDataService = new OptimizedDataService();