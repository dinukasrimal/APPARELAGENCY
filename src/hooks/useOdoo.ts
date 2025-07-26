import { useState, useEffect, useCallback } from 'react';
import odooService, { OdooProduct, OdooPartner, OdooSaleOrder, OdooInvoice, OdooInvoiceLine, SyncResult } from '@/services/odoo.service';

interface UseOdooState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useOdoo = () => {
  const [state, setState] = useState<UseOdooState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const initialize = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const success = await odooService.initialize();
      setState({
        isAuthenticated: success,
        isLoading: false,
        error: success ? null : 'Authentication failed',
      });
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const resetError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    initialize,
    resetError,
    odooService,
  };
};

// Hook for products
export const useOdooProducts = (limit = 50) => {
  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getProducts(limit);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const searchProducts = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.searchProducts(query);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProduct = useCallback(async (productData: Partial<OdooProduct>) => {
    setIsLoading(true);
    setError(null);
    try {
      const id = await odooService.createProduct(productData);
      await fetchProducts(); // Refresh the list
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: number, productData: Partial<OdooProduct>) => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await odooService.updateProduct(id, productData);
      if (success) {
        await fetchProducts(); // Refresh the list
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await odooService.deleteProduct(id);
      if (success) {
        await fetchProducts(); // Refresh the list
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    fetchProducts,
    searchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};

// Hook for partners
export const useOdooPartners = (limit = 50) => {
  const [partners, setPartners] = useState<OdooPartner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getPartners(limit);
      setPartners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch partners');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const searchPartners = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.searchPartners(query);
      setPartners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search partners');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPartner = useCallback(async (partnerData: Partial<OdooPartner>) => {
    setIsLoading(true);
    setError(null);
    try {
      const id = await odooService.createPartner(partnerData);
      await fetchPartners(); // Refresh the list
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPartners]);

  const updatePartner = useCallback(async (id: number, partnerData: Partial<OdooPartner>) => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await odooService.updatePartner(id, partnerData);
      if (success) {
        await fetchPartners(); // Refresh the list
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update partner');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPartners]);

  return {
    partners,
    isLoading,
    error,
    fetchPartners,
    searchPartners,
    createPartner,
    updatePartner,
  };
};

// Hook for sale orders
export const useOdooSaleOrders = (limit = 50) => {
  const [orders, setOrders] = useState<OdooSaleOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getSaleOrders(limit);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  return {
    orders,
    isLoading,
    error,
    fetchOrders,
  };
};

// Hook for invoices
export const useOdooInvoices = (limit = 50) => {
  const [invoices, setInvoices] = useState<OdooInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getInvoices(limit);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const getInvoiceById = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getInvoiceById(id);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getInvoiceLines = useCallback(async (invoiceId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getInvoiceLines(invoiceId);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice lines');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getInvoicesByDateRange = useCallback(async (startDate: string, endDate: string, limit = 100) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await odooService.getInvoicesByDateRange(startDate, endDate, limit);
      setInvoices(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices by date range');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    invoices,
    isLoading,
    error,
    fetchInvoices,
    getInvoiceById,
    getInvoiceLines,
    getInvoicesByDateRange,
  };
};

// Hook for invoice syncing
export const useOdooInvoiceSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncInvoices = useCallback(async (
    agencyId: string,
    startDate?: string,
    endDate?: string,
    limit = 100
  ) => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);
    
    try {
      const result = await odooService.syncInvoicesToSupabase(agencyId, startDate, endDate, limit);
      setSyncResult(result);
      
      if (!result.success) {
        setError(result.message);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync invoices';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const resetSync = useCallback(() => {
    setSyncResult(null);
    setError(null);
  }, []);

  return {
    isSyncing,
    syncResult,
    error,
    syncInvoices,
    resetSync,
  };
}; 