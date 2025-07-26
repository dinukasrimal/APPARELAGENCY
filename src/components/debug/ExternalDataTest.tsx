import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Database, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useExternalConnection, useExternalSalesTargets, useExternalInvoices } from '@/hooks/useExternalData';
import { supabase } from '@/integrations/supabase/client';

interface ExternalDataTestProps {
  className?: string;
}

const ExternalDataTest: React.FC<ExternalDataTestProps> = ({ className }) => {
  const [testAgencyName, setTestAgencyName] = useState('');
  
  const {
    isConnected,
    isLoading: connectionLoading,
    error: connectionError,
    stats,
    testConnection,
    isAvailable
  } = useExternalConnection();

  const {
    targets,
    isLoading: targetsLoading,
    error: targetsError,
    refetch: refetchTargets
  } = useExternalSalesTargets(testAgencyName || undefined);

  const {
    invoices,
    isLoading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices
  } = useExternalInvoices(testAgencyName || undefined);

  const handleTestAgencyData = () => {
    if (testAgencyName.trim()) {
      refetchTargets();
      refetchInvoices();
    }
  };

  const addSampleData = async () => {
    try {
      console.log('Adding sample data...');
      
      // Sample targets for NEXUS MARKETING user  
      const sampleTargets = [
        {
          id: 'ext_target_nexus_2024_q1',
          customer_name: 'NEXUS MARKETING', // This should match the user's name from profiles table
          target_year: 2024,
          target_months: 'Q1',
          base_year: 2023,
          target_data: {
            categories: [
              { category: 'Apparel', target: 500000, percentage: 50 },
              { category: 'Accessories', target: 300000, percentage: 30 },
              { category: 'Footwear', target: 200000, percentage: 20 }
            ]
          },
          initial_total_value: 800000,
          adjusted_total_value: 1000000,
          percentage_increase: 25.0,
          created_by: 'system'
        },
        {
          id: 'ext_target_nexus_2024_q2',
          customer_name: 'NEXUS MARKETING',
          target_year: 2024,
          target_months: 'Q2',
          base_year: 2023,
          target_data: {
            categories: [
              { category: 'Apparel', target: 600000, percentage: 50 },
              { category: 'Accessories', target: 360000, percentage: 30 },
              { category: 'Footwear', target: 240000, percentage: 20 }
            ]
          },
          initial_total_value: 960000,
          adjusted_total_value: 1200000,
          percentage_increase: 25.0,
          created_by: 'system'
        }
      ];

      // Sample invoices for NEXUS MARKETING user
      const sampleInvoices = [
        {
          id: 'ext_invoice_nexus_001',
          name: 'INV/2024/0001',
          partner_name: 'NEXUS MARKETING',
          date_order: '2024-01-15',
          amount_total: 150000,
          state: 'posted',
          order_lines: [
            { product_category: 'Apparel', product_name: 'Cotton T-Shirts', price_total: 75000 },
            { product_category: 'Accessories', product_name: 'Baseball Caps', price_total: 45000 },
            { product_category: 'Footwear', product_name: 'Canvas Sneakers', price_total: 30000 }
          ]
        },
        {
          id: 'ext_invoice_nexus_002',
          name: 'INV/2024/0025',
          partner_name: 'NEXUS MARKETING',
          date_order: '2024-02-20',
          amount_total: 225000,
          state: 'posted',
          order_lines: [
            { product_category: 'Apparel', product_name: 'Polo Shirts', price_total: 120000 },
            { product_category: 'Accessories', product_name: 'Wristbands', price_total: 65000 },
            { product_category: 'Footwear', product_name: 'Sports Shoes', price_total: 40000 }
          ]
        }
      ];

      // Insert targets
      const { error: targetsError } = await supabase
        .from('external_sales_targets')
        .upsert(sampleTargets, { onConflict: 'id' });

      if (targetsError) {
        console.error('Error inserting targets:', targetsError);
        alert('Error adding targets: ' + targetsError.message);
        return;
      }

      // Insert invoices
      const { error: invoicesError } = await supabase
        .from('external_invoices')
        .upsert(sampleInvoices, { onConflict: 'id' });

      if (invoicesError) {
        console.error('Error inserting invoices:', invoicesError);
        alert('Error adding invoices: ' + invoicesError.message);
        return;
      }

      alert('✅ Sample data added successfully! Refresh the page to see changes.');
      
      // Auto-refresh the connection test and data
      testConnection();
      if (testAgencyName === 'NEXUS MARKETING') {
        refetchTargets();
        refetchInvoices();
      }

    } catch (error) {
      console.error('Error adding sample data:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const createTables = async () => {
    try {
      console.log('Creating external tables...');
      
      // Create external_sales_targets table
      const createTargetsTable = `
        CREATE TABLE IF NOT EXISTS public.external_sales_targets (
          id TEXT NOT NULL PRIMARY KEY,
          customer_name TEXT NOT NULL,
          target_year INTEGER NOT NULL,
          target_months TEXT,
          base_year INTEGER,
          target_data JSONB,
          initial_total_value DECIMAL(15,2) DEFAULT 0,
          adjusted_total_value DECIMAL(15,2) DEFAULT 0,
          percentage_increase DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          created_by TEXT,
          
          CHECK (initial_total_value >= 0),
          CHECK (adjusted_total_value >= 0),
          CHECK (percentage_increase >= -100)
        )
      `;

      // Create external_invoices table
      const createInvoicesTable = `
        CREATE TABLE IF NOT EXISTS public.external_invoices (
          id TEXT NOT NULL PRIMARY KEY,
          name TEXT,
          partner_name TEXT NOT NULL,
          date_order DATE NOT NULL,
          amount_total DECIMAL(15,2) NOT NULL DEFAULT 0,
          state TEXT,
          order_lines JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          
          CHECK (amount_total >= 0)
        )
      `;

      // Execute table creation
      const { error: targetsError } = await supabase.rpc('exec_sql', { sql: createTargetsTable });
      const { error: invoicesError } = await supabase.rpc('exec_sql', { sql: createInvoicesTable });

      if (targetsError) {
        console.error('Error creating targets table:', targetsError);
        alert('Error creating targets table: ' + targetsError.message);
        return;
      }

      if (invoicesError) {
        console.error('Error creating invoices table:', invoicesError);
        alert('Error creating invoices table: ' + invoicesError.message);
        return;
      }

      alert('✅ Tables created successfully!');
      testConnection();

    } catch (error) {
      console.error('Error creating tables:', error);
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            External Supabase Integration Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Status */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Configuration Status</h3>
            <div className="flex items-center gap-2">
              {isAvailable ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">External client configured</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">External client not configured</span>
                </>
              )}
            </div>
            
            {!isAvailable && (
              <Alert>
                <AlertDescription>
                  External Supabase credentials not found. Please add your external project URL and API key to the .env file:
                  <br />
                  <code className="text-sm bg-gray-100 px-1 rounded">NEXT_PUBLIC_EXTERNAL_SUPABASE_URL</code>
                  <br />
                  <code className="text-sm bg-gray-100 px-1 rounded">NEXT_PUBLIC_EXTERNAL_SUPABASE_ANON_KEY</code>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Connection Test */}
          {isAvailable && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Connection Test</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={testConnection} 
                    disabled={connectionLoading}
                    variant="outline"
                  >
                    {connectionLoading ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button 
                    onClick={createTables}
                    variant="secondary"
                  >
                    Create Tables
                  </Button>
                  <Button 
                    onClick={addSampleData}
                    variant="default"
                  >
                    Add Sample Data
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-600" />
                    <span className="text-green-700">Connected successfully</span>
                  </>
                ) : connectionError ? (
                  <>
                    <WifiOff className="h-5 w-5 text-red-600" />
                    <span className="text-red-700">Connection failed</span>
                  </>
                ) : (
                  <>
                    <Database className="h-5 w-5 text-gray-600" />
                    <span className="text-gray-700">Not tested yet</span>
                  </>
                )}
              </div>

              {connectionError && (
                <Alert variant="destructive">
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              {stats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-blue-600">Sales Targets</div>
                    <div className="text-2xl font-bold text-blue-700">{stats.targetsCount}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm text-green-600">Invoices</div>
                    <div className="text-2xl font-bold text-green-700">{stats.invoicesCount}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Agency Data Test */}
          {isAvailable && isConnected && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Agency Data Test</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter agency name to test"
                  value={testAgencyName}
                  onChange={(e) => setTestAgencyName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
                <Button 
                  onClick={handleTestAgencyData}
                  disabled={!testAgencyName.trim() || targetsLoading || invoicesLoading}
                >
                  Test Agency Data
                </Button>
              </div>

              {testAgencyName && (
                <div className="space-y-4">
                  {/* Sales Targets Results */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Sales Targets</h4>
                      <Badge variant={targetsError ? 'destructive' : 'default'}>
                        {targetsLoading ? 'Loading...' : `${targets.length} found`}
                      </Badge>
                    </div>
                    
                    {targetsError && (
                      <Alert variant="destructive">
                        <AlertDescription>{targetsError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {targets.length > 0 && (
                      <div className="space-y-2">
                        {targets.slice(0, 3).map((target, index) => (
                          <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                            <div className="font-medium">{target.customer_name}</div>
                            <div className="text-gray-600">
                              {target.target_year} • {target.target_months} • 
                              Rs {(target.adjusted_total_value || target.initial_total_value).toLocaleString()}
                            </div>
                          </div>
                        ))}
                        {targets.length > 3 && (
                          <div className="text-sm text-gray-500">
                            ...and {targets.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Invoices Results */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Invoices</h4>
                      <Badge variant={invoicesError ? 'destructive' : 'default'}>
                        {invoicesLoading ? 'Loading...' : `${invoices.length} found`}
                      </Badge>
                    </div>
                    
                    {invoicesError && (
                      <Alert variant="destructive">
                        <AlertDescription>{invoicesError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {invoices.length > 0 && (
                      <div className="space-y-2">
                        {invoices.slice(0, 3).map((invoice, index) => (
                          <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                            <div className="font-medium">{invoice.partner_name}</div>
                            <div className="text-gray-600">
                              {invoice.date_order} • Rs {invoice.amount_total.toLocaleString()}
                            </div>
                          </div>
                        ))}
                        {invoices.length > 3 && (
                          <div className="text-sm text-gray-500">
                            ...and {invoices.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalDataTest;