import { supabase } from '@/integrations/supabase/client';

export interface SyncStatus {
  lastSyncTime: string | null;
  lastSyncStatus: string | null;
  lastSyncCount: number | null;
  lastSyncMessage: string | null;
}

export class SyncStatusService {
  
  async getLatestSyncStatus(): Promise<SyncStatus> {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_external_bot_sync_status');

      if (error) {
        console.error('Error getting sync status:', error);
        return {
          lastSyncTime: null,
          lastSyncStatus: 'unknown',
          lastSyncCount: null,
          lastSyncMessage: `Error: ${error.message}`
        };
      }

      if (!data || data.length === 0) {
        return {
          lastSyncTime: null,
          lastSyncStatus: 'never_synced',
          lastSyncCount: null,
          lastSyncMessage: 'No sync history found'
        };
      }

      const latest = data[0];
      return {
        lastSyncTime: latest.last_sync_time,
        lastSyncStatus: latest.last_sync_status,
        lastSyncCount: latest.last_sync_count,
        lastSyncMessage: latest.last_sync_message
      };

    } catch (error: any) {
      console.error('Unexpected error getting sync status:', error);
      return {
        lastSyncTime: null,
        lastSyncStatus: 'error',
        lastSyncCount: null,
        lastSyncMessage: `Unexpected error: ${error.message}`
      };
    }
  }

  async triggerManualSync(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/cron-sync-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source: 'manual' })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Manual sync failed: ${response.status} ${response.statusText}`,
          details: errorText
        };
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message || 'Manual sync completed',
        details: result
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Manual sync request failed: ${error.message}`
      };
    }
  }

  async testCronSync(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { data, error } = await supabase.rpc('test_cron_sync');
      
      if (error) {
        return {
          success: false,
          message: `Cron test failed: ${error.message}`,
          details: error
        };
      }

      return {
        success: data?.success || true,
        message: data?.message || 'Cron test completed',
        details: data
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Cron test request failed: ${error.message}`
      };
    }
  }

  async getCronJobStatus(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('external_bot_cron_history')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error getting cron job status:', error);
        return [];
      }

      return data || [];

    } catch (error: any) {
      console.error('Unexpected error getting cron job status:', error);
      return [];
    }
  }

  async getSyncHistory(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('external_bot_sync_log')
        .select('*')
        .order('sync_timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting sync history:', error);
        return [];
      }

      return data || [];

    } catch (error: any) {
      console.error('Unexpected error getting sync history:', error);
      return [];
    }
  }
}

// Create singleton instance
export const syncStatusService = new SyncStatusService();