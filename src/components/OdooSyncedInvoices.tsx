import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';

interface OdooInvoice {
  id: string;
  odoo_id: number;
  odoo_name: string;
  partner_name: string;
  partner_email?: string;
  invoice_date: string;
  due_date?: string;
  amount_total: number;
  state: string;
  payment_state: string;
  sync_status: string;
  synced_at: string;
}

interface OdooInvoiceItem {
  id: string;
  odoo_invoice_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  price_total: number;
  discount: number;
}

export const OdooSyncedInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<OdooInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('odoo_invoices')
        .select('*')
        .order('invoice_date', { ascending: false });

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('state', statusFilter);
      }
      if (paymentFilter !== 'all') {
        query = query.eq('payment_state', paymentFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setInvoices(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, paymentFilter]);

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.odoo_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.partner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.partner_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const getStatusBadgeVariant = (state: string) => {
    switch (state) {
      case 'draft': return 'secondary';
      case 'open': return 'default';
      case 'paid': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getPaymentBadgeVariant = (paymentState: string) => {
    switch (paymentState) {
      case 'not_paid': return 'destructive';
      case 'paid': return 'default';
      case 'partial': return 'secondary';
      default: return 'outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button onClick={fetchInvoices} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Synced Odoo Invoices</span>
            <Button onClick={fetchInvoices} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by invoice number, partner name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All States</option>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
              
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Payments</option>
                <option value="not_paid">Not Paid</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          {/* Invoices List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading invoices...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{invoice.odoo_name}</h3>
                          <Badge variant="outline">#{invoice.odoo_id}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Partner:</span>
                            <p className="font-medium">{invoice.partner_name}</p>
                            {invoice.partner_email && (
                              <p className="text-gray-500 text-xs">{invoice.partner_email}</p>
                            )}
                          </div>
                          
                          <div>
                            <span className="text-gray-600">Invoice Date:</span>
                            <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
                            {invoice.due_date && (
                              <p className="text-gray-500 text-xs">Due: {formatDate(invoice.due_date)}</p>
                            )}
                          </div>
                          
                          <div>
                            <span className="text-gray-600">Amount:</span>
                            <p className="font-bold text-lg text-green-600">
                              {formatCurrency(invoice.amount_total)}
                            </p>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusBadgeVariant(invoice.state)}>
                                {invoice.state}
                              </Badge>
                              <Badge variant={getPaymentBadgeVariant(invoice.payment_state)}>
                                {invoice.payment_state}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">
                              Synced: {formatDate(invoice.synced_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1 ml-4">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredInvoices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' 
                ? 'No invoices match your filters'
                : 'No invoices found. Sync some invoices from Odoo first.'
              }
            </div>
          )}

          {/* Summary */}
          {filteredInvoices.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Invoices:</span>
                  <span className="ml-2 font-medium">{filteredInvoices.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.amount_total, 0))}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Paid Invoices:</span>
                  <span className="ml-2 font-medium">
                    {filteredInvoices.filter(inv => inv.payment_state === 'paid').length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Pending Payment:</span>
                  <span className="ml-2 font-medium">
                    {filteredInvoices.filter(inv => inv.payment_state !== 'paid').length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OdooSyncedInvoices; 