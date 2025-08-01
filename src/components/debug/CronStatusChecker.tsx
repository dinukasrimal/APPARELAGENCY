import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  start_time?: string;
  end_time?: string;
  return_message?: string;
  status?: string;
}

export const CronStatusChecker = () => {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);

  const checkCronJobs = async () => {
    setLoading(true);
    try {
      // Check if cron jobs exist
      const { data: jobs, error: jobsError } = await supabase
        .from('external_bot_cron_history')
        .select('*')
        .limit(10);

      if (jobsError) {
        console.error('Error checking cron jobs:', jobsError);
        setCronJobs([]);
      } else {
        setCronJobs(jobs || []);
      }

      console.log('Cron jobs data:', jobs);
    } catch (error) {
      console.error('Error checking cron status:', error);
    } finally {
      setLoading(false);
    }
  };

  const testCronFunction = async () => {
    try {
      const { data, error } = await supabase.rpc('test_cron_sync');
      
      if (error) {
        console.error('Cron test error:', error);
        alert(`Cron test failed: ${error.message}`);
      } else {
        console.log('Cron test result:', data);
        alert(`Cron test result: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('Cron function test failed:', error);
      alert(`Cron function test failed: ${error}`);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Auto Sync Status Checker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={checkCronJobs} disabled={loading}>
            {loading ? 'Checking...' : 'Check Cron Jobs'}
          </Button>
          <Button onClick={testCronFunction} variant="outline">
            Test Cron Function
          </Button>
        </div>

        {cronJobs.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold">Recent Cron Job Executions:</h3>
            {cronJobs.map((job, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{job.jobname}</div>
                  <div className="text-sm text-gray-600">
                    Schedule: {job.schedule} | Active: {job.active ? 'Yes' : 'No'}
                  </div>
                  {job.start_time && (
                    <div className="text-xs text-gray-500">
                      Last run: {new Date(job.start_time).toLocaleString()}
                    </div>
                  )}
                </div>
                <Badge variant={job.status === 'success' ? 'default' : 'destructive'}>
                  {job.status === 'success' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {job.status || 'Unknown'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No cron job history found.</p>
            <p className="text-sm">This might mean:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li>• Cron jobs haven't run yet</li>
              <li>• pg_cron extension is not enabled</li>
              <li>• Cron jobs are not properly scheduled</li>
            </ul>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">Auto Sync Setup Status:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>Schedule:</strong> 6:00 AM and 6:00 PM daily</li>
            <li>• <strong>Method:</strong> pg_cron + Edge Functions</li>
            <li>• <strong>Function:</strong> cron-sync-trigger → sync-external-bot-invoices</li>
            <li>• <strong>Logs:</strong> external_bot_sync_log table</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default CronStatusChecker;