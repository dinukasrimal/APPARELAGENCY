import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Invoice } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  MapPin,
  Phone,
  Building
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AgencySelector from '@/components/common/AgencySelector';
import { fetchAllSupabaseRows } from '@/utils/supabasePagination';

interface CustomerEngagementReportProps {
  user: User;
  onBack: () => void;
}

interface NonProductiveVisit {
  id: string;
  customerId: string;
  customerName: string;
  visitDate: Date;
  reason: string;
  notes?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
}

// How a customer is doing this period compared with the previous one of equal
// length. The point of the split is that "did not buy" needs two different
// responses: nobody went to see them, or someone did and still got no order.
type CustomerSegment =
  | 'growing'            // bought more than last period (or is brand new business)
  | 'stable'             // bought about the same
  | 'declining'          // still buying, but less
  | 'lapsed'             // was buying last period, bought nothing this period
  | 'worked_no_sale'     // no invoice, but the rep visited or took an order
  | 'dormant_no_effort'; // no invoice and no visit or order at all

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  growing: 'Growing',
  stable: 'Stable',
  declining: 'Declining',
  lapsed: 'Lapsed',
  worked_no_sale: 'Worked, no sale',
  dormant_no_effort: 'No effort logged',
};

interface CustomerEngagementData {
  customer: Customer;
  agencyName?: string;
  hasInvoices: boolean;
  invoiceCount: number;
  totalInvoiceAmount: number;
  previousInvoiceAmount: number;
  changeAmount: number;
  // null when there was no business last period, so a percentage would be meaningless
  changePercent: number | null;
  lastInvoiceDate: Date | null;
  // All-time, independent of the selected period
  lastInvoiceEver: Date | null;
  lifetimeValue: number;
  hasEverBought: boolean;
  salesOrderCount: number;
  lastEffortDate: Date | null;
  hasEffort: boolean;
  segment: CustomerSegment;
  nonProductiveVisits: NonProductiveVisit[];
}

const CustomerEngagementReport = ({ user, onBack }: CustomerEngagementReportProps) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    user.role === 'superuser' ? null : user.agencyId
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [engagementData, setEngagementData] = useState<CustomerEngagementData[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showUninvoicedCustomers, setShowUninvoicedCustomers] = useState(false);
  const [periodMonths, setPeriodMonths] = useState<number>(3);
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | 'all'>('all');
  const { toast } = useToast();

  // Buying patterns only show up over months, so the period presets are months
  // rather than days. Three months is the default.
  const applyPeriodPreset = (months: number) => {
    const today = new Date();
    const from = new Date(today);
    from.setMonth(from.getMonth() - months);
    setPeriodMonths(months);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(from.toISOString().split('T')[0]);
  };

  useEffect(() => {
    applyPeriodPreset(3);
  }, []);

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    // For non-superusers, agency selection is required
    if (!selectedAgencyId && user.role !== 'superuser') {
      toast({
        title: "Error", 
        description: "Please select an agency",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch customers for the agency (or all agencies for superuser)
      // Paged: an unpaginated select stops at 1000 rows, so a superuser
      // (not filtered to one agency) silently lost customers off the end.
      const customersData = await fetchAllSupabaseRows<any>(() => {
        let query = supabase.from('customers').select('*');
        if (selectedAgencyId) query = query.eq('agency_id', selectedAgencyId);
        return query.order('name').order('id');
      });

      const transformedCustomers: Customer[] = (customersData || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        storefrontPhoto: customer.storefront_photo,
        signature: customer.signature,
        gpsCoordinates: {
          latitude: customer.latitude,
          longitude: customer.longitude
        },
        agencyId: customer.agency_id,
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by
      }));

      setCustomers(transformedCustomers);

      // Fetch agency information if viewing all agencies
      let agencyMap: { [key: string]: string } = {};
      if (!selectedAgencyId && user.role === 'superuser') {
        const { data: agenciesData, error: agenciesError } = await supabase
          .from('agencies')
          .select('id, name');
        
        if (!agenciesError && agenciesData) {
          agencyMap = agenciesData.reduce((map, agency) => {
            map[agency.id] = agency.name;
            return map;
          }, {} as { [key: string]: string });
        }
      }

      const invoicesData = await fetchAllSupabaseRows<any>(() => {
        let invoicesQuery = supabase
          .from('invoices')
          .select('*');

        if (selectedAgencyId) {
          invoicesQuery = invoicesQuery.eq('agency_id', selectedAgencyId);
        }

        return invoicesQuery
          .gte('created_at', `${startDate}T00:00:00.000Z`)
          .lte('created_at', `${endDate}T23:59:59.999Z`);
      });

      // The equal-length window immediately before this one, so "declining"
      // and "lapsed" are measured against a like-for-like period.
      const periodStart = new Date(`${startDate}T00:00:00.000Z`);
      const periodEnd = new Date(`${endDate}T23:59:59.999Z`);
      const previousEnd = new Date(periodStart.getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - (periodEnd.getTime() - periodStart.getTime()));

      const previousInvoicesData = await fetchAllSupabaseRows<any>(() => {
        let q = supabase.from('invoices').select('customer_id, total, created_at');
        if (selectedAgencyId) q = q.eq('agency_id', selectedAgencyId);
        return q
          .gte('created_at', previousStart.toISOString())
          .lte('created_at', previousEnd.toISOString());
      });

      // Lifetime history, so "Last invoice: Never" means never — not merely
      // "not in the selected period". Without this a customer who bought four
      // months ago is indistinguishable from one who has never bought at all,
      // which is the difference between a win-back call and a cold prospect.
      const lifetimeInvoicesData = await fetchAllSupabaseRows<any>(() => {
        let q = supabase.from('invoices').select('customer_id, total, created_at');
        if (selectedAgencyId) q = q.eq('agency_id', selectedAgencyId);
        return q;
      });

      const lifetimeByCustomer = new Map<string, { total: number; last: Date | null }>();
      (lifetimeInvoicesData || []).forEach((inv) => {
        if (!inv.customer_id) return;
        const entry = lifetimeByCustomer.get(inv.customer_id) || { total: 0, last: null };
        entry.total += Number(inv.total || 0);
        const at = inv.created_at ? new Date(inv.created_at) : null;
        if (at && (!entry.last || at > entry.last)) entry.last = at;
        lifetimeByCustomer.set(inv.customer_id, entry);
      });

      // Sales orders count as rep effort: the rep reached the customer even if
      // it never turned into an invoice.
      const salesOrdersData = await fetchAllSupabaseRows<any>(() => {
        let q = supabase.from('sales_orders').select('customer_id, created_at');
        if (selectedAgencyId) q = q.eq('agency_id', selectedAgencyId);
        return q
          .gte('created_at', periodStart.toISOString())
          .lte('created_at', periodEnd.toISOString());
      });

      const previousAmountByCustomer = new Map<string, number>();
      (previousInvoicesData || []).forEach((inv) => {
        if (!inv.customer_id) return;
        previousAmountByCustomer.set(
          inv.customer_id,
          (previousAmountByCustomer.get(inv.customer_id) || 0) + Number(inv.total || 0)
        );
      });

      const ordersByCustomer = new Map<string, { count: number; last: Date | null }>();
      (salesOrdersData || []).forEach((order) => {
        if (!order.customer_id) return;
        const entry = ordersByCustomer.get(order.customer_id) || { count: 0, last: null };
        entry.count += 1;
        const at = order.created_at ? new Date(order.created_at) : null;
        if (at && (!entry.last || at > entry.last)) entry.last = at;
        ordersByCustomer.set(order.customer_id, entry);
      });

      // Fetch non-productive visits for the date range
      let visitsData = [];
      try {
        let visitsQuery = supabase
          .from('non_productive_visits')
          .select('*');
        
        if (selectedAgencyId) {
          visitsQuery = visitsQuery.eq('agency_id', selectedAgencyId);
        }
        
        const { data, error: visitsError } = await visitsQuery
          .gte('created_at', `${startDate}T00:00:00.000Z`)
          .lte('created_at', `${endDate}T23:59:59.999Z`);

        if (visitsError) {
          console.warn('Non-productive visits query error:', visitsError);
          visitsData = []; // Continue with empty visits data
        } else {
          visitsData = data || [];
        }
      } catch (visitsError) {
        console.warn('Non-productive visits table might not exist:', visitsError);
        visitsData = []; // Continue with empty visits data
      }

      // Debug logging
      console.log('Debug - Agency ID:', selectedAgencyId || 'ALL AGENCIES (superuser)');
      console.log('Debug - Date range:', `${startDate} to ${endDate}`);
      console.log('Debug - Customers found:', transformedCustomers.length);
      console.log('Debug - Invoices found:', (invoicesData || []).length);
      console.log('Debug - Visits found:', (visitsData || []).length);
      console.log('Debug - Agency map:', agencyMap);

      // Process data for each customer
      const engagementResults: CustomerEngagementData[] = transformedCustomers.map(customer => {
        try {
          const customerInvoices = (invoicesData || []).filter(invoice => invoice.customer_id === customer.id);
          
          const customerVisits: NonProductiveVisit[] = (visitsData || [])
            .filter(visit => {
              try {
                // Handle both new format (with customer_id) and old format (with potential_customer name matching)
                const matchesById = visit.customer_id === customer.id;
                const matchesByPotentialCustomer = visit.potential_customer && 
                  visit.potential_customer.toLowerCase().trim() === customer.name.toLowerCase().trim();
                const matchesByCustomerName = visit.customer_name && 
                  visit.customer_name.toLowerCase().trim() === customer.name.toLowerCase().trim();
                
                return matchesById || matchesByPotentialCustomer || matchesByCustomerName;
              } catch (error) {
                console.warn('Error processing visit for customer:', customer.name, error);
                return false;
              }
            })
            .map(visit => {
              try {
                return {
                  id: visit.id,
                  customerId: visit.customer_id || customer.id,
                  customerName: visit.customer_name || visit.potential_customer || customer.name,
                  visitDate: new Date(visit.created_at || Date.now()),
                  reason: visit.reason || 'No reason provided',
                  notes: visit.notes || '',
                  gpsCoordinates: {
                    latitude: visit.latitude || 0,
                    longitude: visit.longitude || 0
                  }
                };
              } catch (error) {
                console.warn('Error transforming visit:', visit.id, error);
                return null;
              }
            })
            .filter(visit => visit !== null) as NonProductiveVisit[];

          const totalInvoiceAmount = customerInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
          const previousInvoiceAmount = previousAmountByCustomer.get(customer.id) || 0;
          const changeAmount = totalInvoiceAmount - previousInvoiceAmount;
          const changePercent = previousInvoiceAmount > 0
            ? (changeAmount / previousInvoiceAmount) * 100
            : null;

          const lastInvoiceDate = customerInvoices.reduce<Date | null>((latest, inv) => {
            const at = inv.created_at ? new Date(inv.created_at) : null;
            return at && (!latest || at > latest) ? at : latest;
          }, null);

          const lifetime = lifetimeByCustomer.get(customer.id);
          const lastInvoiceEver = lifetime?.last || null;
          const lifetimeValue = lifetime?.total || 0;
          const hasEverBought = !!lastInvoiceEver;

          const orders = ordersByCustomer.get(customer.id);
          const salesOrderCount = orders?.count || 0;
          const lastVisitDate = customerVisits.reduce<Date | null>(
            (latest, v) => (!latest || v.visitDate > latest ? v.visitDate : latest),
            null
          );
          const lastEffortDate = [orders?.last || null, lastVisitDate]
            .filter((d): d is Date => !!d)
            .reduce<Date | null>((latest, d) => (!latest || d > latest ? d : latest), null);
          const hasEffort = customerVisits.length > 0 || salesOrderCount > 0;

          const hasInvoices = customerInvoices.length > 0;
          let segment: CustomerSegment;
          if (hasInvoices) {
            if (previousInvoiceAmount <= 0) segment = 'growing';
            else if (changeAmount < 0) segment = 'declining';
            else if (changeAmount > 0) segment = 'growing';
            else segment = 'stable';
          } else if (previousInvoiceAmount > 0) {
            segment = 'lapsed';
          } else {
            segment = hasEffort ? 'worked_no_sale' : 'dormant_no_effort';
          }

          return {
            customer,
            agencyName: agencyMap[customer.agencyId] || undefined,
            hasInvoices,
            invoiceCount: customerInvoices.length,
            totalInvoiceAmount,
            previousInvoiceAmount,
            changeAmount,
            changePercent,
            lastInvoiceDate,
            lastInvoiceEver,
            lifetimeValue,
            hasEverBought,
            salesOrderCount,
            lastEffortDate,
            hasEffort,
            segment,
            nonProductiveVisits: customerVisits
          };
        } catch (error) {
          console.warn('Error processing customer:', customer.name, error);
          return {
            customer,
            agencyName: agencyMap[customer.agencyId] || undefined,
            hasInvoices: false,
            invoiceCount: 0,
            totalInvoiceAmount: 0,
            previousInvoiceAmount: 0,
            changeAmount: 0,
            changePercent: null,
            lastInvoiceDate: null,
            lastInvoiceEver: null,
            lifetimeValue: 0,
            hasEverBought: false,
            salesOrderCount: 0,
            lastEffortDate: null,
            hasEffort: false,
            segment: 'dormant_no_effort' as CustomerSegment,
            nonProductiveVisits: []
          };
        }
      });

      console.log('Debug - Engagement results processed:', engagementResults.length);

      setEngagementData(engagementResults);
      setReportGenerated(true);

      toast({
        title: "Success",
        description: "Customer engagement report generated successfully",
      });

    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalCustomers = engagementData.length;
  const invoicedCustomers = engagementData.filter(data => data.hasInvoices).length;
  const uninvoicedCustomers = engagementData.filter(data => !data.hasInvoices);
  const invoicedPercentage = totalCustomers > 0 ? ((invoicedCustomers / totalCustomers) * 100).toFixed(1) : '0.0';

  const totalNonProductiveVisits = uninvoicedCustomers.reduce((sum, customer) => sum + customer.nonProductiveVisits.length, 0);

  const segmentCounts = engagementData.reduce((acc, d) => {
    acc[d.segment] = (acc[d.segment] || 0) + 1;
    return acc;
  }, {} as Record<CustomerSegment, number>);

  // The split that makes "did not buy" actionable.
  const noSaleWithEffort = engagementData.filter(d => !d.hasInvoices && d.hasEffort).length;
  const noSaleNoEffort = engagementData.filter(d => !d.hasInvoices && !d.hasEffort).length;

  // "No effort" is mostly customers who have never bought at all, which is a
  // prospecting problem. The ones who HAVE bought before and now have nobody
  // calling on them are the few worth chasing today, so count them separately.
  const winBackNoEffort = engagementData.filter(d => !d.hasInvoices && !d.hasEffort && d.hasEverBought);
  const winBackNoEffortValue = winBackNoEffort.reduce((sum, d) => sum + d.lifetimeValue, 0);
  const neverBought = engagementData.filter(d => !d.hasInvoices && !d.hasEverBought).length;

  const decliningCustomers = engagementData.filter(d => d.segment === 'declining');
  const lapsedCustomers = engagementData.filter(d => d.segment === 'lapsed');
  const valueLostFromDeclines = decliningCustomers.reduce((sum, d) => sum + Math.abs(d.changeAmount), 0);
  const valueLostFromLapsed = lapsedCustomers.reduce((sum, d) => sum + d.previousInvoiceAmount, 0);

  const SEGMENT_ORDER: CustomerSegment[] = [
    'lapsed', 'declining', 'dormant_no_effort', 'worked_no_sale', 'stable', 'growing',
  ];

  // Worst first: the customers worth chasing today are the ones who used to buy
  // and stopped, then the ones buying less.
  const segmentRank: Record<CustomerSegment, number> = {
    lapsed: 0, declining: 1, dormant_no_effort: 2, worked_no_sale: 3, stable: 4, growing: 5,
  };
  const rankedCustomers = [...engagementData]
    .filter(d => segmentFilter === 'all' || d.segment === segmentFilter)
    .sort((a, b) => {
      if (segmentRank[a.segment] !== segmentRank[b.segment]) {
        return segmentRank[a.segment] - segmentRank[b.segment];
      }
      // Biggest money at risk first
      const aRisk = a.segment === 'lapsed' ? a.previousInvoiceAmount : Math.abs(Math.min(0, a.changeAmount));
      const bRisk = b.segment === 'lapsed' ? b.previousInvoiceAmount : Math.abs(Math.min(0, b.changeAmount));
      if (aRisk !== bRisk) return bRisk - aRisk;
      // Nothing at risk on either (the no-sale segments): a customer who used
      // to spend is worth more attention than one who never bought at all.
      return b.lifetimeValue - a.lifetimeValue;
    });

  const money = (n: number) => `LKR ${Math.round(n).toLocaleString()}`;
  const segmentBadgeClass = (segment: CustomerSegment) => {
    switch (segment) {
      case 'lapsed': return 'bg-red-100 text-red-800';
      case 'declining': return 'bg-orange-100 text-orange-800';
      case 'dormant_no_effort': return 'bg-yellow-100 text-yellow-800';
      case 'worked_no_sale': return 'bg-blue-100 text-blue-800';
      case 'stable': return 'bg-gray-100 text-gray-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Engagement Analytics</h1>
          <p className="text-gray-600">Analyze customer engagement and lead conversion effectiveness</p>
        </div>
      </div>

      {/* Agency Selector for Superusers */}
      <AgencySelector
        user={user}
        selectedAgencyId={selectedAgencyId}
        onAgencyChange={setSelectedAgencyId}
        placeholder={user.role === 'superuser' ? "Select specific agency or leave empty for all agencies..." : "Select agency for engagement report..."}
      />

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Report Period
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Period</Label>
            <div className="flex flex-wrap gap-2">
              {[3, 6, 9, 12].map((months) => (
                <Button
                  key={months}
                  type="button"
                  size="sm"
                  variant={periodMonths === months ? 'default' : 'outline'}
                  onClick={() => applyPeriodPreset(months)}
                >
                  {months} months
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Compared against the previous {periodMonths} months to show who is buying less.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button 
            onClick={generateReport} 
            disabled={loading || (!selectedAgencyId && user.role !== 'superuser')}
            className="w-full md:w-auto"
          >
            {loading ? 'Generating Report...' : `Generate Report${!selectedAgencyId && user.role === 'superuser' ? ' (All Agencies)' : ''}`}
          </Button>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportGenerated && (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-blue-600">{totalCustomers}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Invoiced Customers</p>
                    <p className="text-2xl font-bold text-green-600">{invoicedCustomers}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Un-invoiced Customers</p>
                    <p className="text-2xl font-bold text-red-600">{uninvoicedCustomers.length}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-purple-600">{invoicedPercentage}%</p>
                  </div>
                  <div className="text-purple-600">
                    {parseFloat(invoicedPercentage) >= 50 ? 
                      <TrendingUp className="h-8 w-8" /> : 
                      <TrendingDown className="h-8 w-8" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Why they didn't buy — the split that decides what to do next */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-red-200">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Lapsed</p>
                <p className="text-2xl font-bold text-red-600">{segmentCounts.lapsed || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Bought last period, nothing now · {money(valueLostFromLapsed)} at risk
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-200">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Declining</p>
                <p className="text-2xl font-bold text-orange-600">{segmentCounts.declining || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Still buying, but less · {money(valueLostFromDeclines)} down
                </p>
              </CardContent>
            </Card>

            <Card className="border-yellow-200">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">No sale, no effort</p>
                <p className="text-2xl font-bold text-yellow-700">{noSaleNoEffort}</p>
                <p className="text-xs text-gray-500 mt-1">
                  No invoice and no visit or order logged — a coverage gap
                </p>
                <p className="text-xs mt-2">
                  <span className="font-semibold text-yellow-800">{winBackNoEffort.length} bought before</span>
                  <span className="text-gray-500"> · {money(winBackNoEffortValue)} lifetime — chase these first</span>
                </p>
                <p className="text-xs text-gray-400">
                  {neverBought} have never bought at all
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Worked, no sale</p>
                <p className="text-2xl font-bold text-blue-600">{noSaleWithEffort}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Rep visited or took an order but nothing was invoiced
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Customer-by-customer movement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-600" />
                Customer Movement ({rankedCustomers.length})
              </CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant={segmentFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setSegmentFilter('all')}
                >
                  All ({engagementData.length})
                </Button>
                {SEGMENT_ORDER.map((segment) => (
                  <Button
                    key={segment}
                    type="button"
                    size="sm"
                    variant={segmentFilter === segment ? 'default' : 'outline'}
                    onClick={() => setSegmentFilter(segment)}
                  >
                    {SEGMENT_LABELS[segment]} ({segmentCounts[segment] || 0})
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {rankedCustomers.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">No customers in this group.</p>
              ) : (
                <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white border-b">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2 font-semibold">Customer</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold text-right">This period</th>
                        <th className="px-3 py-2 font-semibold text-right">Previous</th>
                        <th className="px-3 py-2 font-semibold text-right">Change</th>
                        <th className="px-3 py-2 font-semibold text-right">Last invoice</th>
                        <th className="px-3 py-2 font-semibold text-right">Effort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedCustomers.map((d) => (
                        <tr key={d.customer.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium">{d.customer.name}</div>
                            <div className="text-xs text-gray-500">
                              {d.customer.phone}
                              {d.agencyName ? ` · ${d.agencyName}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${segmentBadgeClass(d.segment)}`}>
                              {SEGMENT_LABELS[d.segment]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{money(d.totalInvoiceAmount)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{money(d.previousInvoiceAmount)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${
                            d.changeAmount < 0 ? 'text-red-600' : d.changeAmount > 0 ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {d.previousInvoiceAmount === 0 && d.totalInvoiceAmount === 0
                              ? '—'
                              : `${d.changeAmount > 0 ? '+' : ''}${money(d.changeAmount)}`}
                            {d.changePercent !== null && (
                              <span className="block text-xs font-normal">
                                {d.changePercent > 0 ? '+' : ''}{d.changePercent.toFixed(0)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {d.lastInvoiceEver ? (
                              <>
                                <div>{d.lastInvoiceEver.toLocaleDateString()}</div>
                                {!d.hasInvoices && (
                                  <div className="text-xs text-gray-400">not this period</div>
                                )}
                              </>
                            ) : 'Never'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {d.hasEffort ? (
                              <>
                                <div className="text-xs">
                                  {d.nonProductiveVisits.length > 0 && `${d.nonProductiveVisits.length} visit${d.nonProductiveVisits.length > 1 ? 's' : ''}`}
                                  {d.nonProductiveVisits.length > 0 && d.salesOrderCount > 0 && ' · '}
                                  {d.salesOrderCount > 0 && `${d.salesOrderCount} order${d.salesOrderCount > 1 ? 's' : ''}`}
                                </div>
                                {d.lastEffortDate && (
                                  <div className="text-xs text-gray-400">{d.lastEffortDate.toLocaleDateString()}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-yellow-700">None logged</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Un-invoiced Customers Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Un-invoiced Customers ({uninvoicedCustomers.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUninvoicedCustomers(!showUninvoicedCustomers)}
                  className="flex items-center gap-2"
                >
                  {showUninvoicedCustomers ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Expand Details
                    </>
                  )}
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                Total Non-productive Visits: <span className="font-semibold text-blue-600">{totalNonProductiveVisits}</span>
              </div>
            </CardHeader>

            {showUninvoicedCustomers && (
              <CardContent>
                {uninvoicedCustomers.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Excellent!</h3>
                    <p className="text-gray-600">All customers have invoices in the selected period.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uninvoicedCustomers.map((customerData) => (
                      <Card key={customerData.customer.id} className="border-l-4 border-l-red-400">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">
                                {customerData.customer.name}
                                {customerData.agencyName && (
                                  <span className="ml-2 text-sm font-normal text-blue-600">
                                    ({customerData.agencyName})
                                  </span>
                                )}
                              </h4>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  {customerData.customer.phone}
                                </div>
                                <div className="flex items-start gap-2">
                                  <Building className="h-4 w-4 mt-0.5" />
                                  <span>{customerData.customer.address}</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant={customerData.nonProductiveVisits.length > 0 ? "secondary" : "destructive"}>
                              {customerData.nonProductiveVisits.length} visits
                            </Badge>
                          </div>

                          {/* Non-productive Visits */}
                          {customerData.nonProductiveVisits.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              <h5 className="text-sm font-medium text-gray-700">Non-productive Visits:</h5>
                              <div className="space-y-2">
                                {customerData.nonProductiveVisits.map((visit) => (
                                  <div key={visit.id} className="bg-gray-50 p-3 rounded-md">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-4 w-4 text-gray-500" />
                                        <span className="font-medium">
                                          {visit.visitDate.toLocaleDateString()}
                                        </span>
                                      </div>
                                      {visit.gpsCoordinates.latitude !== 0 && (
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                          <MapPin className="h-3 w-3" />
                                          {visit.gpsCoordinates.latitude.toFixed(4)}, {visit.gpsCoordinates.longitude.toFixed(4)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      <span className="font-medium">Reason:</span> {visit.reason}
                                    </div>
                                    {visit.notes && (
                                      <div className="text-sm text-gray-600 mt-1">
                                        <span className="font-medium">Notes:</span> {visit.notes}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                              <p className="text-sm text-red-700">
                                ⚠️ No engagement attempts recorded for this customer during the selected period.
                                Consider reaching out to convert this lead.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default CustomerEngagementReport;
