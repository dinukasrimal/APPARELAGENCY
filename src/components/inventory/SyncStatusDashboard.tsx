import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, CheckCircle, XCircle, Calendar, AlertTriangle } from 'lucide-react';
import { externalBotSyncService, SyncStatus } from '@/services/external-bot-sync';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SyncStatusDashboardProps {
  onRefresh?: () => void;
  onGlobalSync?: () => void;
}

interface CronSyncRequest {
  sync_timestamp: string;
  status: string;
  message: string;
  action_needed: string;
}

const SyncStatusDashboard = ({ onRefresh, onGlobalSync }: SyncStatusDashboardProps) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [cronRequests, setCronRequests] = useState<CronSyncRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchCronRequests = async () => {
    try {
      const { data } = await supabase
        .from('cron_sync_requests')
        .select('*')
        .limit(5);
      
      setCronRequests(data || []);
    } catch (error) {
      console.error('Error fetching cron requests:', error);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const [status] = await Promise.all([
        externalBotSyncService.getDetailedSyncStatus(),
        fetchCronRequests()
      ]);
      setSyncStatus(status);
    } catch (error) {
      console.error('Error fetching sync status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSyncStatus();
    if (onRefresh) {
      onRefresh();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSyncStatus();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchSyncStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusIcon = (status: 'success' | 'error' | 'never' | 'pending') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-amber-500 animate-pulse" />;
      case 'never':
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: 'success' | 'error' | 'never' | 'pending') => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'never':
        return 'secondary';
    }
  };

  const getNextExternalSyncTime = () => {
    if (!syncStatus) return null;
    
    const now = new Date();
    const morningTime = new Date(syncStatus.nextScheduledSync.externalBot.morning);
    const eveningTime = new Date(syncStatus.nextScheduledSync.externalBot.evening);
    
    // Find the next sync (whichever comes first)
    const nextSync = morningTime < eveningTime ? morningTime : eveningTime;
    
    return nextSync;
  };

  const getNextGlobalSyncTime = () => {
    if (!syncStatus) return null;
    
    const now = new Date();
    const morningTime = new Date(syncStatus.nextScheduledSync.globalBot.morning);
    const eveningTime = new Date(syncStatus.nextScheduledSync.globalBot.evening);
    
    // Find the next sync (whichever comes first)
    const nextSync = morningTime < eveningTime ? morningTime : eveningTime;
    
    return nextSync;
  };

  const formatTimeUntilNext = (nextSyncTime: Date | null) => {
    if (!nextSyncTime) return '';
    
    const now = new Date();
    const diff = nextSyncTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Due now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Sync Status
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!syncStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Sync Status Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Unable to fetch sync status. Please try refreshing.
          </p>
          <Button onClick={handleRefresh} className="mt-2" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sync Status Dashboard</h3>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* External Bot Sync Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {getStatusIcon(syncStatus.lastExternalBotSync.status)}
                External Bot Sync
              </span>
              <Badge variant={getStatusBadgeVariant(syncStatus.lastExternalBotSync.status)}>
                {syncStatus.lastExternalBotSync.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Last Sync</p>
                <p className="text-sm font-medium">
                  {formatDateTime(syncStatus.lastExternalBotSync.timestamp)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm">{syncStatus.lastExternalBotSync.message}</p>
              </div>
              {syncStatus.lastExternalBotSync.syncedCount > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Records Synced</p>
                  <p className="text-sm font-medium">
                    {syncStatus.lastExternalBotSync.syncedCount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Global Bot Sync Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {getStatusIcon(syncStatus.lastGlobalBotSync.status)}
                Global Bot Sync
              </span>
              <Badge variant={getStatusBadgeVariant(syncStatus.lastGlobalBotSync.status)}>
                {syncStatus.lastGlobalBotSync.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Last Sync</p>
                <p className="text-sm font-medium">
                  {formatDateTime(syncStatus.lastGlobalBotSync.timestamp)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm">{syncStatus.lastGlobalBotSync.message}</p>
              </div>
              {syncStatus.lastGlobalBotSync.processedCount > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Items Processed</p>
                  <p className="text-sm font-medium">
                    {syncStatus.lastGlobalBotSync.processedCount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Scheduled Syncs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* External Bot Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              External Bot Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Morning (6:00 AM UTC)</p>
                <p className="text-sm font-medium">
                  {formatDateTime(syncStatus.nextScheduledSync.externalBot.morning)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Evening (6:00 PM UTC)</p>
                <p className="text-sm font-medium">
                  {formatDateTime(syncStatus.nextScheduledSync.externalBot.evening)}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500">
                Next external sync {formatTimeUntilNext(getNextExternalSyncTime())}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Global Bot Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Global Bot Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Morning (8:00 AM UTC)</p>
                <p className="text-sm font-medium">
                  {formatDateTime(syncStatus.nextScheduledSync.globalBot.morning)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Evening (8:00 PM UTC)</p>
                <p className="text-sm font-medium">
                  {formatDateTime(syncStatus.nextScheduledSync.globalBot.evening)}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500">
                Next global sync {formatTimeUntilNext(getNextGlobalSyncTime())}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cron Sync Requests */}
      {cronRequests.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Pending Cron Sync Requests ({cronRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {cronRequests.map((request, index) => (
                <div key={index} className="flex items-start justify-between p-3 bg-white rounded border border-amber-200">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">
                      {formatDateTime(request.sync_timestamp)}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {request.action_needed}
                    </p>
                  </div>
                  {onGlobalSync && (
                    <Button
                      onClick={onGlobalSync}
                      size="sm"
                      className="ml-3 bg-amber-600 hover:bg-amber-700"
                    >
                      Process Now
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-xs text-amber-700">
                💡 These are automatic sync requests from cron jobs. Click "Process Now" or use the Global Sync button to fulfill them.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <p className="text-sm font-medium text-blue-900">Automatic Sync Active</p>
              <p className="text-xs text-blue-700 mt-1">
                System automatically syncs twice daily using PostgreSQL cron jobs. 
                Cron jobs create sync requests that need to be processed manually using the Global Sync button.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncStatusDashboard;