import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncRequest {
  agencyId: string;
  syncType: 'products' | 'invoices' | 'partners';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface SyncResponse {
  success: boolean;
  message: string;
  synced_count: number;
  error_count: number;
  errors: string[];
}

interface UseOdooEdgeFunctionReturn {
  syncData: (request: SyncRequest) => Promise<SyncResponse | null>;
  isSyncing: boolean;
  lastSyncResult: SyncResponse | null;
}

export const useOdooEdgeFunction = (): UseOdooEdgeFunctionReturn => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResponse | null>(null);

  const syncData = async (request: SyncRequest): Promise<SyncResponse | null> => {
    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('odoo-sync', {
        body: request
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      const response: SyncResponse = data;
      setLastSyncResult(response);

      if (response.success) {
        toast.success(response.message);
      } else {
        toast.error(`Sync completed with ${response.error_count} errors`);
      }

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync data';
      toast.error(errorMessage);
      
      const errorResponse: SyncResponse = {
        success: false,
        message: errorMessage,
        synced_count: 0,
        error_count: 1,
        errors: [errorMessage]
      };
      
      setLastSyncResult(errorResponse);
      return errorResponse;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncData,
    isSyncing,
    lastSyncResult
  };
};

export default useOdooEdgeFunction; 