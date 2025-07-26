import React, { useState } from 'react';
import { useOdooInvoiceSync, useOdoo } from '@/hooks/useOdoo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const OdooInvoiceSync: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useOdoo();
  const { isSyncing, syncResult, error, syncInvoices, resetSync } = useOdooInvoiceSync();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(100);
  const [agencyId, setAgencyId] = useState('');

  const handleSync = async () => {
    if (!agencyId.trim()) {
      toast.error('Please enter an Agency ID');
      return;
    }

    try {
      const result = await syncInvoices(agencyId, startDate || undefined, endDate || undefined, limit);
      
      if (result.success) {
        toast.success(`Successfully synced ${result.invoice_count} invoices`);
      } else {
        toast.error(`Sync failed: ${result.message}`);
      }
    } catch (error) {
      toast.error('Failed to sync invoices');
    }
  };

  const handleReset = () => {
    resetSync();
    setStartDate('');
    setEndDate('');
    setLimit(100);
  };

  if (authLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Initializing Odoo connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold">Odoo Authentication Required</p>
            <p className="text-sm text-gray-600 mt-2">
              Please check your Odoo credentials in the environment variables.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sync Odoo Invoices to Supabase
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agency ID */}
          <div className="space-y-2">
            <Label htmlFor="agencyId">Agency ID *</Label>
            <Input
              id="agencyId"
              placeholder="Enter your agency UUID"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              required
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Limit */}
          <div className="space-y-2">
            <Label htmlFor="limit">Maximum Invoices to Sync</Label>
            <Input
              id="limit"
              type="number"
              min="1"
              max="1000"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
            />
          </div>

          {/* Sync Button */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSync} 
              disabled={isSyncing || !agencyId.trim()}
              className="flex-1"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Sync Invoices
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleReset}
              disabled={isSyncing}
            >
              Reset
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Sync Results */}
          {syncResult && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Sync Results</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={syncResult.success ? "default" : "destructive"} className="ml-2">
                    {syncResult.success ? "Success" : "Failed"}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-600">Invoices Synced:</span>
                  <span className="ml-2 font-medium">{syncResult.invoice_count}</span>
                </div>
                <div>
                  <span className="text-gray-600">Errors:</span>
                  <span className="ml-2 font-medium">{syncResult.error_count}</span>
                </div>
                <div>
                  <span className="text-gray-600">Date Range:</span>
                  <span className="ml-2 font-medium">
                    {startDate && endDate ? `${startDate} to ${endDate}` : 'All invoices'}
                  </span>
                </div>
              </div>

              <p className="text-blue-700 mt-2">{syncResult.message}</p>

              {/* Error Details */}
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-700 mb-2">Error Details:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {syncResult.errors.map((err, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-100 p-2 rounded">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Instructions:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Enter your Agency ID (UUID) to sync invoices for your agency</li>
              <li>• Leave date range empty to sync all available invoices</li>
              <li>• Set a limit to control how many invoices to sync at once</li>
              <li>• Only new invoices will be synced (existing ones are skipped)</li>
              <li>• Invoice line items are automatically synced with each invoice</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OdooInvoiceSync; 