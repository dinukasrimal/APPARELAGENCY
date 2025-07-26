// React hooks for external data access
import { useState, useEffect, useCallback } from 'react';
import { externalDataService, ExternalSalesTarget, ExternalInvoice, ExternalDataFilters } from '@/services/external-data.service';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for managing external sales targets
 */
export const useExternalSalesTargets = (userName?: string) => {
  const [targets, setTargets] = useState<ExternalSalesTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTargets = useCallback(async (filters: ExternalDataFilters = {}) => {
    console.log('🔄 useExternalSalesTargets fetchTargets called with userName:', userName);
    
    if (!externalDataService.isAvailable()) {
      console.log('External data service not available for sales targets');
      return;
    }

    if (!userName) {
      console.log('No userName provided, skipping targets fetch');
      setTargets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: serviceError } = await externalDataService.getSalesTargets({
        userName,
        ...filters
      });

      if (serviceError) {
        setError(serviceError);
        toast({
          title: "External Data Error",
          description: `Failed to fetch external sales targets: ${serviceError}`,
          variant: "destructive",
        });
      } else {
        setTargets(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error in useExternalSalesTargets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userName, toast]);

  useEffect(() => {
    console.log('📡 useEffect triggered for fetchTargets, userName:', userName);
    fetchTargets();
  }, [fetchTargets]);

  // Additional effect to trigger when userName changes
  useEffect(() => {
    if (userName) {
      console.log('🔄 userName changed, refetching targets:', userName);
      fetchTargets();
    }
  }, [userName, fetchTargets]);

  return {
    targets,
    isLoading,
    error,
    refetch: fetchTargets,
    isAvailable: externalDataService.isAvailable()
  };
};

/**
 * Hook for managing external invoices
 */
export const useExternalInvoices = (userName?: string) => {
  const [invoices, setInvoices] = useState<ExternalInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInvoices = useCallback(async (filters: ExternalDataFilters = {}) => {
    if (!externalDataService.isAvailable()) {
      console.log('External data service not available for invoices');
      return;
    }
    
    if (!userName) {
      console.log('No userName provided, skipping invoices fetch');
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: serviceError } = await externalDataService.getInvoices({
        userName,
        ...filters
      });

      if (serviceError) {
        setError(serviceError);
        toast({
          title: "External Data Error",
          description: `Failed to fetch external invoices: ${serviceError}`,
          variant: "destructive",
        });
      } else {
        setInvoices(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error in useExternalInvoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userName, toast]);

  useEffect(() => {
    console.log('📡 useEffect triggered for fetchInvoices, userName:', userName);
    fetchInvoices();
  }, [fetchInvoices]);

  // Additional effect to trigger when userName changes
  useEffect(() => {
    if (userName) {
      console.log('🔄 userName changed, refetching invoices:', userName);
      fetchInvoices();
    }
  }, [userName, fetchInvoices]);

  return {
    invoices,
    isLoading,
    error,
    refetch: fetchInvoices,
    isAvailable: externalDataService.isAvailable()
  };
};

/**
 * Hook for external achievement calculation
 */
export const useExternalAchievement = () => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateAchievement = useCallback(async (
    userName: string,
    targetMonths: string,
    year: number
  ): Promise<number> => {
    if (!externalDataService.isAvailable()) {
      console.log('External data service not available for achievement calculation');
      return 0;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const achievement = await externalDataService.calculateExternalAchievement(
        userName,
        targetMonths,
        year
      );
      return achievement;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error calculating external achievement:', err);
      return 0;
    } finally {
      setIsCalculating(false);
    }
  }, []);

  return {
    calculateAchievement,
    isCalculating,
    error,
    isAvailable: externalDataService.isAvailable()
  };
};

/**
 * Hook for testing external connection
 */
export const useExternalConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    stats?: {
      targetsCount: number;
      invoicesCount: number;
    };
  }>({
    isConnected: false,
    isLoading: false,
    error: null
  });

  const testConnection = useCallback(async () => {
    setConnectionStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await externalDataService.testConnection();
      
      setConnectionStatus({
        isConnected: result.success,
        isLoading: false,
        error: result.success ? null : result.message,
        stats: result.stats
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: errorMessage
      });
      return { success: false, message: errorMessage };
    }
  }, []);

  useEffect(() => {
    // Auto-test connection on mount if service is available
    if (externalDataService.isAvailable()) {
      testConnection();
    } else {
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: 'External data service not configured'
      });
    }
  }, [testConnection]);

  return {
    ...connectionStatus,
    testConnection,
    isAvailable: externalDataService.isAvailable()
  };
};

/**
 * Hook for getting available agency names from external data
 */
export const useExternalAgencyNames = () => {
  const [agencyNames, setAgencyNames] = useState<{
    salesTargetAgencies: string[];
    invoiceAgencies: string[];
  }>({
    salesTargetAgencies: [],
    invoiceAgencies: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgencyNames = useCallback(async () => {
    if (!externalDataService.isAvailable()) {
      console.log('External data service not available for agency names');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { salesTargetAgencies, invoiceAgencies, error: serviceError } = 
        await externalDataService.getAvailableAgencyNames();

      if (serviceError) {
        setError(serviceError);
      } else {
        setAgencyNames({ salesTargetAgencies, invoiceAgencies });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching external agency names:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgencyNames();
  }, [fetchAgencyNames]);

  return {
    ...agencyNames,
    isLoading,
    error,
    refetch: fetchAgencyNames,
    isAvailable: externalDataService.isAvailable()
  };
};

/**
 * Combined hook for external targets with achievements
 */
export const useExternalTargetsWithAchievements = (userName?: string) => {
  const { targets, isLoading: targetsLoading, error: targetsError, refetch } = useExternalSalesTargets(userName);
  const { calculateAchievement, isCalculating } = useExternalAchievement();
  const [processedTargets, setProcessedTargets] = useState<(ExternalSalesTarget & { achievement: number })[]>([]);

  // Calculate achievements for all targets
  useEffect(() => {
    const processTargets = async () => {
      if (targets.length === 0) {
        setProcessedTargets([]);
        return;
      }

      const targetsWithAchievements = await Promise.all(
        targets.map(async (target) => {
          const achievement = await calculateAchievement(
            target.customer_name,
            target.target_months,
            target.target_year
          );
          return {
            ...target,
            achievement
          };
        })
      );

      setProcessedTargets(targetsWithAchievements);
    };

    processTargets();
  }, [targets, calculateAchievement]);

  return {
    targets: processedTargets,
    isLoading: targetsLoading || isCalculating,
    error: targetsError,
    refetch,
    isAvailable: externalDataService.isAvailable()
  };
};