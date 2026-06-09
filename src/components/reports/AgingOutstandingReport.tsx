import { Fragment, useEffect, useMemo, useState } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileWarning, Receipt, WalletCards } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllSupabaseRows } from '@/utils/supabasePagination';
import { roundMoney } from '@/utils/money';
import { useToast } from '@/hooks/use-toast';

interface AgingOutstandingReportProps {
  user: User;
  onBack: () => void;
}

interface Agency {
  id: string;
  name: string;
}

interface AgingInvoice {
  id: string;
  invoiceNumber: string | null;
  displayInvoiceNumber: string;
  customerId: string | null;
  customerName: string;
  agencyId: string;
  invoiceDate: string;
  total: number;
  paidAmount: number;
  returnAmount: number;
  outstanding: number;
  ageDays: number;
  bucket: AgingBucketKey;
}

interface CustomerAgingRow {
  customerKey: string;
  customerName: string;
  invoices: AgingInvoice[];
  bucketTotals: Record<AgingBucketKey, number>;
  totalOutstanding: number;
}

type AgingBucketKey = 'days30' | 'days60' | 'days90' | 'days120' | 'days120Plus';

const bucketLabels: Record<AgingBucketKey, string> = {
  days30: '0-30',
  days60: '31-60',
  days90: '61-90',
  days120: '91-120',
  days120Plus: '120+',
};

const formatCurrency = (value: number) => `LKR ${Number(value || 0).toLocaleString()}`;

const toDateInputValue = (date: Date) => date.toISOString().split('T')[0];

const getAgencyPrefix = (agencyName: string) => {
  const prefix = agencyName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return prefix.padEnd(3, 'X');
};

const isCompactInvoiceNumber = (invoiceNumber: string | null) => Boolean(invoiceNumber?.match(/^[A-Z0-9]{3}\d{3,}$/));

const getAgeBucket = (ageDays: number): AgingBucketKey => {
  if (ageDays <= 30) return 'days30';
  if (ageDays <= 60) return 'days60';
  if (ageDays <= 90) return 'days90';
  if (ageDays <= 120) return 'days120';
  return 'days120Plus';
};

const AgingOutstandingReport = ({ user, onBack }: AgingOutstandingReportProps) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState(user.role === 'superuser' ? '' : user.agencyId || '');
  const [asOfDate, setAsOfDate] = useState(toDateInputValue(new Date()));
  const [includeFutureCheques, setIncludeFutureCheques] = useState(false);
  const [rows, setRows] = useState<AgingInvoice[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user.role === 'superuser') {
      fetchAgencies();
    } else {
      setSelectedAgency(user.agencyId || '');
    }
  }, [user]);

  useEffect(() => {
    if (selectedAgency && asOfDate) {
      fetchReportData();
    } else {
      setRows([]);
    }
  }, [selectedAgency, asOfDate, includeFutureCheques]);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch agencies',
        variant: 'destructive',
      });
    }
  };

  const fetchReportData = async () => {
    if (!selectedAgency) return;

    setLoading(true);
    try {
      const asOfEnd = `${asOfDate}T23:59:59`;
      const asOf = new Date(asOfEnd);

      const invoices = await fetchAllSupabaseRows<{
        id: string;
        invoice_number: string | null;
        customer_id: string | null;
        customer_name: string;
        agency_id: string;
        total: number;
        created_at: string | null;
      }>(() =>
        supabase
          .from('invoices')
          .select('id, invoice_number, customer_id, customer_name, agency_id, total, created_at')
          .eq('agency_id', selectedAgency)
          .lte('created_at', asOfEnd)
      );

      const invoiceIds = invoices.map(invoice => invoice.id);
      if (invoiceIds.length === 0) {
        setRows([]);
        return;
      }

      const selectedAgencyName = agencies.find(agency => agency.id === selectedAgency)?.name || user.agencyName || '';
      const agencyPrefix = getAgencyPrefix(selectedAgencyName);
      const invoiceDisplayNumbers = new Map<string, string>();
      invoices
        .slice()
        .sort((a, b) => {
          const dateCompare = new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
          return dateCompare || a.id.localeCompare(b.id);
        })
        .forEach((invoice, index) => {
          invoiceDisplayNumbers.set(invoice.id, `${agencyPrefix}${String(index + 1).padStart(3, '0')}`);
        });

      const allocations = await fetchAllSupabaseRows<{
        invoice_id: string;
        collection_id: string;
        allocated_amount: number;
      }>(() =>
        supabase
          .from('collection_allocations')
          .select('invoice_id, collection_id, allocated_amount')
          .in('invoice_id', invoiceIds)
      );

      const collectionIds = Array.from(new Set(allocations.map(allocation => allocation.collection_id)));
      const collections = collectionIds.length > 0
        ? await fetchAllSupabaseRows<{
            id: string;
            total_amount: number;
            cash_amount: number | null;
            cash_discount: number | null;
          }>(() =>
            supabase
              .from('collections')
              .select('id, total_amount, cash_amount, cash_discount')
              .in('id', collectionIds)
          )
        : [];

      const cheques = collectionIds.length > 0
        ? await fetchAllSupabaseRows<{
            collection_id: string;
            amount: number;
            cheque_date: string;
            status: string | null;
          }>(() =>
            supabase
              .from('collection_cheques')
              .select('collection_id, amount, cheque_date, status')
              .in('collection_id', collectionIds)
          )
        : [];

      const returns = await fetchAllSupabaseRows<{
        invoice_id: string | null;
        total: number | null;
        status: string | null;
      }>(() =>
        supabase
          .from('returns')
          .select('invoice_id, total, status')
          .in('invoice_id', invoiceIds)
          .in('status', ['approved', 'processed'])
      );

      const chequesByCollection = new Map<string, typeof cheques>();
      cheques.forEach((cheque) => {
        const list = chequesByCollection.get(cheque.collection_id) || [];
        list.push(cheque);
        chequesByCollection.set(cheque.collection_id, list);
      });

      const collectionPaymentRatio = new Map<string, number>();
      collections.forEach((collection) => {
        const collectionCheques = chequesByCollection.get(collection.id) || [];
        const eligibleChequeAmount = collectionCheques.reduce((sum, cheque) => {
          if (cheque.status === 'returned' || cheque.status === 'held' || cheque.status === 'resolved') return sum;
          if (includeFutureCheques) return sum + Number(cheque.amount || 0);

          const chequeDate = new Date(`${cheque.cheque_date}T23:59:59`);
          return chequeDate <= asOf ? sum + Number(cheque.amount || 0) : sum;
        }, 0);
        const eligiblePayment = roundMoney(
          Number(collection.cash_amount || 0) +
          Number(collection.cash_discount || 0) +
          eligibleChequeAmount
        );
        const totalAmount = Number(collection.total_amount || 0);
        const ratio = totalAmount > 0 ? Math.min(eligiblePayment / totalAmount, 1) : 0;
        collectionPaymentRatio.set(collection.id, ratio);
      });

      const paidByInvoice = new Map<string, number>();
      allocations.forEach((allocation) => {
        const ratio = collectionPaymentRatio.get(allocation.collection_id) ?? 1;
        const eligibleAllocatedAmount = roundMoney(Number(allocation.allocated_amount || 0) * ratio);
        paidByInvoice.set(
          allocation.invoice_id,
          roundMoney((paidByInvoice.get(allocation.invoice_id) || 0) + eligibleAllocatedAmount)
        );
      });

      const returnsByInvoice = new Map<string, number>();
      returns.forEach((item) => {
        if (!item.invoice_id) return;
        returnsByInvoice.set(
          item.invoice_id,
          roundMoney((returnsByInvoice.get(item.invoice_id) || 0) + Number(item.total || 0))
        );
      });

      const reportRows = invoices
        .map((invoice) => {
          const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : asOf;
          const ageDays = Math.max(0, Math.floor((asOf.getTime() - invoiceDate.getTime()) / (24 * 60 * 60 * 1000)));
          const total = Number(invoice.total || 0);
          const paidAmount = paidByInvoice.get(invoice.id) || 0;
          const returnAmount = returnsByInvoice.get(invoice.id) || 0;
          const outstanding = Math.max(0, roundMoney(total - paidAmount - returnAmount));

          return {
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            displayInvoiceNumber: isCompactInvoiceNumber(invoice.invoice_number)
              ? invoice.invoice_number
              : invoiceDisplayNumbers.get(invoice.id) || invoice.id,
            customerId: invoice.customer_id,
            customerName: invoice.customer_name,
            agencyId: invoice.agency_id,
            invoiceDate: invoice.created_at || asOf.toISOString(),
            total,
            paidAmount,
            returnAmount,
            outstanding,
            ageDays,
            bucket: getAgeBucket(ageDays),
          };
        })
        .filter((invoice) => invoice.outstanding > 0)
        .sort((a, b) => b.ageDays - a.ageDays || b.outstanding - a.outstanding);

      setRows(reportRows);
    } catch (error) {
      console.error('Error fetching aging outstanding report:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch aging outstanding report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const bucketTotals = useMemo(() => {
    const totals: Record<AgingBucketKey, { amount: number; count: number }> = {
      days30: { amount: 0, count: 0 },
      days60: { amount: 0, count: 0 },
      days90: { amount: 0, count: 0 },
      days120: { amount: 0, count: 0 },
      days120Plus: { amount: 0, count: 0 },
    };

    rows.forEach((row) => {
      totals[row.bucket].amount = roundMoney(totals[row.bucket].amount + row.outstanding);
      totals[row.bucket].count += 1;
    });

    return totals;
  }, [rows]);

  const customerRows = useMemo<CustomerAgingRow[]>(() => {
    const grouped = new Map<string, CustomerAgingRow>();

    rows.forEach((invoice) => {
      const customerKey = invoice.customerId || invoice.customerName;
      const current = grouped.get(customerKey) || {
        customerKey,
        customerName: invoice.customerName,
        invoices: [],
        bucketTotals: {
          days30: 0,
          days60: 0,
          days90: 0,
          days120: 0,
          days120Plus: 0,
        },
        totalOutstanding: 0,
      };

      current.invoices.push(invoice);
      current.bucketTotals[invoice.bucket] = roundMoney(current.bucketTotals[invoice.bucket] + invoice.outstanding);
      current.totalOutstanding = roundMoney(current.totalOutstanding + invoice.outstanding);
      grouped.set(customerKey, current);
    });

    return Array.from(grouped.values())
      .map((customer) => ({
        ...customer,
        invoices: customer.invoices.slice().sort((a, b) => b.ageDays - a.ageDays || b.outstanding - a.outstanding),
      }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding || a.customerName.localeCompare(b.customerName));
  }, [rows]);

  const totalOutstanding = rows.reduce((sum, row) => roundMoney(sum + row.outstanding), 0);

  const toggleCustomer = (customerKey: string) => {
    setExpandedCustomers((current) => {
      const next = new Set(current);
      if (next.has(customerKey)) {
        next.delete(customerKey);
      } else {
        next.add(customerKey);
      }
      return next;
    });
  };

  const exportCSV = () => {
    const selectedAgencyName = agencies.find(agency => agency.id === selectedAgency)?.name || user.agencyName || 'Selected Agency';
    const headers = [
      'Customer',
      '0-30',
      '31-60',
      '61-90',
      '91-120',
      '120+',
      'Total Outstanding',
      'Invoice Count',
      'Agency',
      'Future Cheques Included',
    ];
    const csvRows = customerRows.map((row) => [
      row.customerName,
      row.bucketTotals.days30.toString(),
      row.bucketTotals.days60.toString(),
      row.bucketTotals.days90.toString(),
      row.bucketTotals.days120.toString(),
      row.bucketTotals.days120Plus.toString(),
      row.totalOutstanding.toString(),
      row.invoices.length.toString(),
      selectedAgencyName,
      includeFutureCheques ? 'Yes' : 'No',
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aging-outstanding-${asOfDate}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Aging Outstanding Report</h1>
            <p className="text-gray-600">Outstanding invoices by aging bucket</p>
          </div>
        </div>

        <Button variant="outline" onClick={exportCSV} disabled={loading || rows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">As Of Date</label>
              <Input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </div>

            {user.role === 'superuser' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Agency</label>
                <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-end">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3 w-full">
                <div>
                  <p className="text-sm font-medium text-gray-900">Include Future Cheques</p>
                  <p className="text-xs text-gray-500">Treat non-returned customer cheques as payments.</p>
                </div>
                <Switch checked={includeFutureCheques} onCheckedChange={setIncludeFutureCheques} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAgency ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <Card className="xl:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Outstanding</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOutstanding)}</p>
                    <p className="text-xs text-gray-500">{customerRows.length} customer{customerRows.length === 1 ? '' : 's'}</p>
                  </div>
                  <WalletCards className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            {(Object.keys(bucketLabels) as AgingBucketKey[]).map((bucket) => (
              <Card key={bucket}>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">{bucketLabels[bucket]} Days</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(bucketTotals[bucket].amount)}</p>
                  <p className="text-xs text-gray-500">{bucketTotals[bucket].count} invoice{bucketTotals[bucket].count === 1 ? '' : 's'}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Customer Aging Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading aging report...</div>
              ) : customerRows.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <FileWarning className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                  No outstanding invoices found for the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium">Customer</th>
                        <th className="px-3 py-3 text-right font-medium">0-30</th>
                        <th className="px-3 py-3 text-right font-medium">31-60</th>
                        <th className="px-3 py-3 text-right font-medium">61-90</th>
                        <th className="px-3 py-3 text-right font-medium">91-120</th>
                        <th className="px-3 py-3 text-right font-medium">120+</th>
                        <th className="px-3 py-3 text-right font-medium">Total</th>
                        <th className="px-3 py-3 text-right font-medium">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerRows.map((customer) => {
                        const isExpanded = expandedCustomers.has(customer.customerKey);

                        return (
                          <Fragment key={customer.customerKey}>
                            <tr className="border-t bg-white hover:bg-gray-50">
                              <td className="px-3 py-3 text-gray-800">
                                <button
                                  type="button"
                                  onClick={() => toggleCustomer(customer.customerKey)}
                                  className="flex items-center gap-2 font-medium hover:text-blue-700"
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  {customer.customerName}
                                </button>
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(customer.bucketTotals.days30)}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(customer.bucketTotals.days60)}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(customer.bucketTotals.days90)}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(customer.bucketTotals.days120)}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(customer.bucketTotals.days120Plus)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-900">{formatCurrency(customer.totalOutstanding)}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{customer.invoices.length}</td>
                            </tr>

                            {isExpanded && (
                              <tr className="border-t bg-gray-50">
                                <td colSpan={8} className="px-4 py-4">
                                  <div className="overflow-x-auto rounded-lg border bg-white">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium">Invoice Date</th>
                                          <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                                          <th className="px-3 py-2 text-right font-medium">Age</th>
                                          <th className="px-3 py-2 text-left font-medium">Bucket</th>
                                          <th className="px-3 py-2 text-right font-medium">Invoice Total</th>
                                          <th className="px-3 py-2 text-right font-medium">Payments</th>
                                          <th className="px-3 py-2 text-right font-medium">Returns</th>
                                          <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {customer.invoices.map((invoice) => (
                                          <tr key={invoice.id} className="border-t">
                                            <td className="px-3 py-2 text-gray-700">{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                                            <td className="px-3 py-2 text-gray-700 font-mono text-xs">{invoice.displayInvoiceNumber}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{invoice.ageDays}</td>
                                            <td className="px-3 py-2">
                                              <Badge variant={invoice.bucket === 'days120Plus' ? 'destructive' : 'secondary'}>
                                                {bucketLabels[invoice.bucket]}
                                              </Badge>
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(invoice.total)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(invoice.paidAmount)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(invoice.returnAmount)}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(invoice.outstanding)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-gray-600">
            Select an agency to view the aging outstanding report.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgingOutstandingReport;
