import { useState, useEffect, Fragment } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Search, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllSupabaseRows } from '@/utils/supabasePagination';
import { useToast } from '@/hooks/use-toast';
import { getDisplayInvoiceNumber } from '@/utils/invoiceNumber';

interface SalesReportProps {
  user: User;
  onBack: () => void;
}

interface Agency {
  id: string;
  name: string;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  displayNumber: string;
  customerId: string;
  customerName: string;
  agencyName: string;
  total: number;
  createdAt: string;
}

interface CustomerSummary {
  customerId: string;
  customerName: string;
  agencyName: string;
  invoices: InvoiceRow[];
  totalValue: number;
}

const SalesReport = ({ user, onBack }: SalesReportProps) => {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState(user.role === 'superuser' ? '' : user.agencyId || '');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  useEffect(() => {
    if (user.role === 'superuser') {
      supabase.from('agencies').select('id, name').order('name')
        .then(({ data }) => setAgencies(data || []));
    }
  }, [user.role]);

  const agencyName = agencies.find(a => a.id === selectedAgency)?.name || user.agencyName || '';

  const fetchReport = async () => {
    if (!selectedAgency) {
      toast({ title: 'Select an agency', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const from = `${startDate}T00:00:00`;
      const to = `${endDate}T23:59:59`;
      const isAll = selectedAgency === '__all__';

      const data = await fetchAllSupabaseRows<{
        id: string; invoice_number: string | null; customer_id: string | null;
        customer_name: string | null; total: number; created_at: string; agency_id: string;
      }>(() => {
        let query = supabase
          .from('invoices')
          .select('id, invoice_number, customer_id, customer_name, total, created_at, agency_id')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('customer_name', { ascending: true });
        if (!isAll) query = query.eq('agency_id', selectedAgency);
        return query;
      });

      const agencyNameById = new Map(agencies.map(a => [a.id, a.name]));
      const invoiceList: InvoiceRow[] = (data || []).map((inv, idx) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number || '',
        displayNumber: getDisplayInvoiceNumber(inv.invoice_number, idx + 1, agencyNameById.get(inv.agency_id) || agencyName, inv.agency_id),
        customerId: inv.customer_id || '',
        customerName: inv.customer_name || 'Unknown',
        agencyName: agencyNameById.get(inv.agency_id) || agencyName || 'Unknown',
        total: Number(inv.total),
        createdAt: inv.created_at,
      }));

      // Group by customer
      const map = new Map<string, CustomerSummary>();
      for (const inv of invoiceList) {
        const key = inv.customerId || inv.customerName;
        if (!map.has(key)) {
          map.set(key, { customerId: inv.customerId, customerName: inv.customerName, agencyName: inv.agencyName, invoices: [], totalValue: 0 });
        }
        const entry = map.get(key)!;
        entry.invoices.push(inv);
        entry.totalValue += inv.total;
      }

      setCustomers(Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter(c =>
    c.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = filtered.reduce((sum, c) => sum + c.totalValue, 0);
  const totalInvoices = filtered.reduce((sum, c) => sum + c.invoices.length, 0);

  const downloadExcel = () => {
    if (customers.length === 0) return;

    // Collect all unique invoice display numbers as pivot columns
    const allInvoices = customers.flatMap(c => c.invoices);
    // For the pivot: rows = customers, columns = invoice numbers
    // Build pivot: customer → invoice number → amount
    // We show each customer's invoices spread across columns

    // Header row
    const rows: string[][] = [];

    // Summary sheet style: customer | inv1 | inv2 | ... | total
    // Since different customers have different invoices, we just list each customer's invoices per row

    // Row per invoice, grouped by customer, with subtotal rows
    const headerCols = ['Customer Name', 'Agency', 'Invoice Number', 'Invoice Date', 'Invoice Value (LKR)'];
    rows.push(headerCols);

    for (const cust of customers) {
      for (const inv of cust.invoices) {
        rows.push([
          cust.customerName,
          inv.agencyName,
          inv.displayNumber,
          new Date(inv.createdAt).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' }),
          inv.total.toFixed(2),
        ]);
      }
      // Subtotal row per customer
      rows.push([cust.customerName, cust.agencyName, `Total (${cust.invoices.length} invoice${cust.invoices.length !== 1 ? 's' : ''})`, '', cust.totalValue.toFixed(2)]);
      rows.push([]); // blank separator
    }

    // Grand total
    rows.push(['GRAND TOTAL', '', '', '', grandTotal.toFixed(2)]);

    // Pivot sheet: rows = customers, columns = each invoice number
    // Collect all invoice display numbers in order
    const pivotRows: string[][] = [];
    const allDisplayNums = allInvoices.map(i => i.displayNumber);
    // Pivot header
    pivotRows.push(['Customer Name', ...allDisplayNums.map(n => n), 'Total (LKR)']);

    for (const cust of customers) {
      const invMap = new Map(cust.invoices.map(i => [i.displayNumber, i.total]));
      pivotRows.push([
        cust.customerName,
        ...allDisplayNums.map(n => invMap.has(n) ? invMap.get(n)!.toFixed(2) : ''),
        cust.totalValue.toFixed(2),
      ]);
    }
    pivotRows.push(['GRAND TOTAL', ...allDisplayNums.map(() => ''), grandTotal.toFixed(2)]);

    // Encode as CSV with two sections separated by blank lines
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const toCSV = (r: string[][]) => r.map(row => row.map(esc).join(',')).join('\n');

    const csv = [
      `Sales Report: ${startDate} to ${endDate}`,
      `Agency: ${agencyName}`,
      '',
      '=== DETAIL VIEW ===',
      toCSV(rows),
      '',
      '=== PIVOT VIEW (Invoice columns) ===',
      toCSV(pivotRows),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-gray-600">Customer invoice summary by date range</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {user.role === 'superuser' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Agency</label>
                <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Agencies</SelectItem>
                    {agencies.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchReport} disabled={loading} className="w-full">
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {customers.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-gray-500">Total Customers</p>
                <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold text-purple-600">{totalInvoices}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-gray-500">Total Value</p>
                <p className="text-2xl font-bold text-green-600">LKR {grandTotal.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search + Download */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={downloadExcel}>
              <Download className="h-4 w-4 mr-2" />
              Download Excel (CSV)
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Agency</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Invoices</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Total Value (LKR)</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(cust => (
                      <Fragment key={cust.customerId || cust.customerName}>
                        <tr
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedCustomer(
                            expandedCustomer === cust.customerId ? null : cust.customerId
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{cust.customerName}</td>
                          <td className="px-4 py-3 text-gray-600">{cust.agencyName}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{cust.invoices.length}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">
                            {cust.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs">
                            {expandedCustomer === cust.customerId ? '▲ hide' : '▼ invoices'}
                          </td>
                        </tr>
                        {expandedCustomer === cust.customerId && cust.invoices.map(inv => (
                          <tr key={inv.id} className="bg-blue-50 border-b">
                            <td className="px-4 py-2 pl-10 text-gray-600 text-xs">{inv.displayNumber}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{inv.agencyName}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">
                              {new Date(inv.createdAt).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' })}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700 text-xs">
                              {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="px-4 py-3">Grand Total</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right">{totalInvoices}</td>
                      <td className="px-4 py-3 text-right text-green-700">
                        {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {customers.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Select a date range and generate the report to see results.</p>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
