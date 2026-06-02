
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, Users, ShoppingCart, AlertTriangle, Download, TrendingUp, Percent, ArrowLeft, MapPin, Receipt, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Agency {
  id: string;
  name: string;
}

interface ReportMetrics {
  customersOnboarded: number;
  salesConversionRate: number;
  totalCustomers: number;
  customersWithSales: number;
  nonProductiveVisits: number;
  totalSalesOrders: number;
}

interface OdometerDetail {
  timeTrackingId: string;
  userId: string;
  userName: string;
  clockInKm: number | null;
  clockOutKm: number | null;
  totalKm: number;
}

interface CustomerOnboardedDetail {
  id: string;
  name: string;
  createdAt: string | null;
  createdBy: string | null;
  createdByName: string;
}

interface NonProductiveDetail {
  id: string;
  customerName: string | null;
  reason: string;
  potentialCustomer: string | null;
  createdAt: string;
  userId: string;
  userName: string;
}

interface ExpenseDetail {
  id: string;
  category: string;
  amount: number;
  notes: string | null;
  occurredAt: string;
  userId: string;
  userName: string;
}

interface SalesOrderDetail {
  id: string;
  customerName: string;
  orderNumber: string | null;
  status: string | null;
  total: number;
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
}

interface DailySummary {
  date: string;
  totalKm: number;
  totalExpenses: number;
  totalSales: number;
  customersOnboardedDetails: CustomerOnboardedDetail[];
  nonProductiveDetails: NonProductiveDetail[];
  odometerDetails: OdometerDetail[];
  expenseDetails: ExpenseDetail[];
  salesOrderDetails: SalesOrderDetail[];
}

interface EnhancedReportsProps {
  user: User;
  onBack: () => void;
}

const EnhancedReports = ({ user, onBack }: EnhancedReportsProps) => {
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAgency, setSelectedAgency] = useState<string>(user.role === 'superuser' ? '' : user.agencyId || '');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [metrics, setMetrics] = useState<ReportMetrics>({
    customersOnboarded: 0,
    salesConversionRate: 0,
    totalCustomers: 0,
    customersWithSales: 0,
    nonProductiveVisits: 0,
    totalSalesOrders: 0
  });
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [summaryTotals, setSummaryTotals] = useState({
    totalKm: 0,
    totalExpenses: 0,
    totalSales: 0,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user.role === 'superuser') {
      fetchAgencies();
    } else {
      setSelectedAgency(user.agencyId!);
    }
  }, [user]);

  useEffect(() => {
    if (selectedAgency && startDate && endDate) {
      fetchReportData();
    } else {
      setDailySummaries([]);
      setSummaryTotals({ totalKm: 0, totalExpenses: 0, totalSales: 0 });
    }
  }, [selectedAgency, startDate, endDate]);

  const toDateKey = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (dateKey: string) => {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString();
  };

  const formatCurrency = (value: number) => {
    return `LKR ${Number(value || 0).toLocaleString()}`;
  };

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
        title: "Error",
        description: "Failed to fetch agencies",
        variant: "destructive",
      });
    }
  };

  const fetchReportData = async () => {
    if (!selectedAgency) return;
    setLoading(true);
    try {
      const startDateTime = `${startDate}T00:00:00`;
      const endDateTime = `${endDate}T23:59:59`;

      const [
        customersOnboardedRes,
        totalCustomersRes,
        customersWithSalesRes,
        nonProductiveVisitsRes,
        timeTrackingRes,
        expensesRes,
        salesOrdersRes,
        customersDetailRes,
        nonProductiveDetailRes,
      ] = await Promise.all([
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', selectedAgency)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', selectedAgency),
        supabase
          .from('sales_orders')
          .select('customer_id')
          .eq('agency_id', selectedAgency)
          .not('customer_id', 'is', null),
        supabase
          .from('non_productive_visits')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', selectedAgency)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime),
        supabase
          .from('time_tracking')
          .select('id, date, user_id')
          .eq('agency_id', selectedAgency)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('agency_expenses')
          .select('id, category, amount, notes, occurred_at, user_id')
          .eq('agency_id', selectedAgency)
          .gte('occurred_at', startDateTime)
          .lte('occurred_at', endDateTime),
        supabase
          .from('sales_orders')
          .select('id, customer_name, order_number, status, total, created_at, created_by')
          .eq('agency_id', selectedAgency)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime),
        supabase
          .from('customers')
          .select('id, name, created_at, created_by')
          .eq('agency_id', selectedAgency)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime),
        supabase
          .from('non_productive_visits')
          .select('id, customer_name, reason, potential_customer, created_at, user_id')
          .eq('agency_id', selectedAgency)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime),
      ]);

      if (customersOnboardedRes.error) throw customersOnboardedRes.error;
      if (totalCustomersRes.error) throw totalCustomersRes.error;
      if (customersWithSalesRes.error) throw customersWithSalesRes.error;
      if (nonProductiveVisitsRes.error) throw nonProductiveVisitsRes.error;
      if (timeTrackingRes.error) throw timeTrackingRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (salesOrdersRes.error) throw salesOrdersRes.error;
      if (customersDetailRes.error) throw customersDetailRes.error;
      if (nonProductiveDetailRes.error) throw nonProductiveDetailRes.error;

      const timeTracking = timeTrackingRes.data || [];
      const expenses = expensesRes.data || [];
      const salesOrders = salesOrdersRes.data || [];
      const customersDetail = customersDetailRes.data || [];
      const nonProductiveDetail = nonProductiveDetailRes.data || [];

      let odometerEntries: Array<{
        time_tracking_id: string;
        odometer_km: number;
        created_at: string | null;
        user_id: string;
      }> = [];

      if (timeTracking.length > 0) {
        const { data, error } = await supabase
          .from('time_tracking_odometer_entries')
          .select('time_tracking_id, odometer_km, created_at, user_id')
          .in('time_tracking_id', timeTracking.map((record) => record.id));

        if (error) throw error;
        odometerEntries = data || [];
      }

      const userIds = new Set<string>();
      timeTracking.forEach((record) => record.user_id && userIds.add(record.user_id));
      expenses.forEach((expense) => expense.user_id && userIds.add(expense.user_id));
      salesOrders.forEach((order) => order.created_by && userIds.add(order.created_by));
      customersDetail.forEach((customer) => customer.created_by && userIds.add(customer.created_by));
      nonProductiveDetail.forEach((visit) => visit.user_id && userIds.add(visit.user_id));

      const { data: profilesData, error: profilesError } = userIds.size
        ? await supabase.from('profiles').select('id, name').in('id', Array.from(userIds))
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const userNameById = new Map(
        (profilesData || []).map((profile) => [profile.id, profile.name])
      );

      const summaryMap = new Map<string, DailySummary>();
      const getSummary = (date: string) => {
        if (!summaryMap.has(date)) {
          summaryMap.set(date, {
            date,
            totalKm: 0,
            totalExpenses: 0,
            totalSales: 0,
            customersOnboardedDetails: [],
            nonProductiveDetails: [],
            odometerDetails: [],
            expenseDetails: [],
            salesOrderDetails: [],
          });
        }
        return summaryMap.get(date)!;
      };

      const odometerByTracking = new Map<string, Array<{
        odometerKm: number;
        createdAt: string | null;
        userId: string;
      }>>();

      odometerEntries.forEach((entry) => {
        const list = odometerByTracking.get(entry.time_tracking_id) || [];
        list.push({
          odometerKm: Number(entry.odometer_km),
          createdAt: entry.created_at,
          userId: entry.user_id,
        });
        odometerByTracking.set(entry.time_tracking_id, list);
      });

      timeTracking.forEach((record) => {
        const entries = odometerByTracking.get(record.id) || [];
        if (entries.length === 0) return;

        const sortedEntries = entries.slice().sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });

        const firstEntry = sortedEntries[0];
        const lastEntry = sortedEntries[sortedEntries.length - 1];
        const clockInKm = firstEntry?.odometerKm ?? null;
        const clockOutKm = lastEntry?.odometerKm ?? null;
        const totalKm = clockInKm !== null && clockOutKm !== null
          ? Math.max(0, clockOutKm - clockInKm)
          : 0;

        const summary = getSummary(record.date);
        summary.totalKm += totalKm;
        summary.odometerDetails.push({
          timeTrackingId: record.id,
          userId: record.user_id,
          userName: userNameById.get(record.user_id) || 'Unknown',
          clockInKm,
          clockOutKm,
          totalKm,
        });
      });

      expenses.forEach((expense) => {
        const dateKey = toDateKey(expense.occurred_at);
        if (!dateKey) return;
        const summary = getSummary(dateKey);
        summary.totalExpenses += Number(expense.amount || 0);
        summary.expenseDetails.push({
          id: expense.id,
          category: expense.category,
          amount: Number(expense.amount || 0),
          notes: expense.notes,
          occurredAt: expense.occurred_at,
          userId: expense.user_id,
          userName: userNameById.get(expense.user_id) || 'Unknown',
        });
      });

      customersDetail.forEach((customer) => {
        if (!customer.created_at) return;
        const dateKey = toDateKey(customer.created_at);
        if (!dateKey) return;
        const summary = getSummary(dateKey);
        summary.customersOnboardedDetails.push({
          id: customer.id,
          name: customer.name,
          createdAt: customer.created_at,
          createdBy: customer.created_by,
          createdByName: customer.created_by ? (userNameById.get(customer.created_by) || 'Unknown') : 'Unknown',
        });
      });

      nonProductiveDetail.forEach((visit) => {
        const dateKey = toDateKey(visit.created_at);
        if (!dateKey) return;
        const summary = getSummary(dateKey);
        summary.nonProductiveDetails.push({
          id: visit.id,
          customerName: visit.customer_name,
          reason: visit.reason,
          potentialCustomer: visit.potential_customer,
          createdAt: visit.created_at,
          userId: visit.user_id,
          userName: userNameById.get(visit.user_id) || 'Unknown',
        });
      });

      salesOrders.forEach((order) => {
        const dateKey = toDateKey(order.created_at);
        if (!dateKey) return;
        const summary = getSummary(dateKey);
        summary.totalSales += Number(order.total || 0);
        summary.salesOrderDetails.push({
          id: order.id,
          customerName: order.customer_name,
          orderNumber: order.order_number,
          status: order.status,
          total: Number(order.total || 0),
          createdAt: order.created_at,
          createdBy: order.created_by,
          createdByName: order.created_by ? (userNameById.get(order.created_by) || 'Unknown') : 'Unknown',
        });
      });

      const dailySummariesList = Array.from(summaryMap.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
      );

      const totals = dailySummariesList.reduce(
        (acc, day) => {
          acc.totalKm += day.totalKm;
          acc.totalExpenses += day.totalExpenses;
          acc.totalSales += day.totalSales;
          return acc;
        },
        { totalKm: 0, totalExpenses: 0, totalSales: 0 }
      );

      setDailySummaries(dailySummariesList);
      setSummaryTotals(totals);

      const customersOnboarded = customersOnboardedRes.count || 0;
      const totalCustomers = totalCustomersRes.count || 0;
      const uniqueCustomersWithSales = new Set(
        (customersWithSalesRes.data || []).map((order) => order.customer_id).filter(Boolean)
      ).size;
      const salesConversionRate = totalCustomers > 0
        ? (uniqueCustomersWithSales / totalCustomers) * 100
        : 0;

      setMetrics({
        customersOnboarded,
        salesConversionRate: Math.round(salesConversionRate * 100) / 100,
        totalCustomers,
        customersWithSales: uniqueCustomersWithSales,
        nonProductiveVisits: nonProductiveVisitsRes.count || 0,
        totalSalesOrders: salesOrders.length,
      });
    } catch (error) {
      console.error('Error fetching report metrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportPivotCSV = () => {
    const selectedAgencyName = agencies.find(a => a.id === selectedAgency)?.name || 'Unknown Agency';
    const headers = [
      'Date',
      'Type',
      'User',
      'Customer',
      'Category',
      'Order Number',
      'Status',
      'Odometer In (km)',
      'Odometer Out (km)',
      'Total Km',
      'Amount',
      'Notes',
      'Occurred At',
      'Agency',
    ];

    const rows: string[][] = [];

    dailySummaries.forEach((day) => {
      day.customersOnboardedDetails.forEach((detail) => {
        rows.push([
          day.date,
          'Customer Onboarded',
          detail.createdByName,
          detail.name,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          detail.createdAt || '',
          selectedAgencyName,
        ]);
      });

      day.nonProductiveDetails.forEach((detail) => {
        rows.push([
          day.date,
          'Non-Productive Visit',
          detail.userName,
          detail.customerName || detail.potentialCustomer || '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          detail.reason,
          detail.createdAt,
          selectedAgencyName,
        ]);
      });

      day.odometerDetails.forEach((detail) => {
        rows.push([
          day.date,
          'Odometer',
          detail.userName,
          '',
          '',
          '',
          '',
          detail.clockInKm !== null ? detail.clockInKm.toString() : '',
          detail.clockOutKm !== null ? detail.clockOutKm.toString() : '',
          detail.totalKm.toString(),
          '',
          '',
          '',
          selectedAgencyName,
        ]);
      });

      day.expenseDetails.forEach((detail) => {
        rows.push([
          day.date,
          'Expense',
          detail.userName,
          '',
          detail.category,
          '',
          '',
          '',
          '',
          '',
          detail.amount.toString(),
          detail.notes || '',
          detail.occurredAt,
          selectedAgencyName,
        ]);
      });

      day.salesOrderDetails.forEach((detail) => {
        rows.push([
          day.date,
          'Sales Order',
          detail.createdByName,
          detail.customerName,
          '',
          detail.orderNumber || '',
          detail.status || '',
          '',
          '',
          '',
          detail.total.toString(),
          '',
          detail.createdAt,
          selectedAgencyName,
        ]);
      });
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced-report-pivot-${startDate}-to-${endDate}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const metricCards = [
    {
      title: 'Customers Onboarded',
      value: metrics.customersOnboarded,
      subtitle: `From ${startDate} to ${endDate}`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Sales Conversion Rate',
      value: `${metrics.salesConversionRate}%`,
      subtitle: `${metrics.customersWithSales} of ${metrics.totalCustomers} customers`,
      icon: Percent,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Non-Productive Visits',
      value: metrics.nonProductiveVisits,
      subtitle: `From ${startDate} to ${endDate}`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Sales Orders Created',
      value: metrics.totalSalesOrders,
      subtitle: `From ${startDate} to ${endDate}`,
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  const summaryCards = [
    {
      title: 'Total KM Traveled',
      value: summaryTotals.totalKm.toLocaleString(),
      subtitle: `From ${startDate} to ${endDate}`,
      icon: MapPin,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Other Expenses',
      value: formatCurrency(summaryTotals.totalExpenses),
      subtitle: `From ${startDate} to ${endDate}`,
      icon: Receipt,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Sales Order Value',
      value: formatCurrency(summaryTotals.totalSales),
      subtitle: `From ${startDate} to ${endDate}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Modern Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Enhanced Reports</h2>
                <p className="text-lg text-slate-600 font-medium">Comprehensive analytics with date range selection</p>
              </div>
              
              <Button 
                onClick={exportPivotCSV} 
                disabled={loading || !selectedAgency}
                className="group relative w-full sm:w-auto h-14 px-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Download className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                Export Pivot CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-3">
                <label className="block text-base font-semibold text-slate-700">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-12 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-base font-semibold text-slate-700">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-12 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {user.role === 'superuser' && (
                <div className="space-y-3">
                  <label className="block text-base font-semibold text-slate-700">Agency</label>
                  <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                    <SelectTrigger className="h-12 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                      <SelectValue placeholder="Select Agency" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-xl">
                      {agencies.map(agency => (
                        <SelectItem key={agency.id} value={agency.id} className="rounded-lg">
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-end">
                <Button 
                  onClick={fetchReportData} 
                  disabled={loading || !selectedAgency} 
                  className="group w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <span className="group-hover:scale-105 transition-transform duration-200">
                    {loading ? 'Loading...' : 'Generate Report'}
                  </span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Cards */}
        {selectedAgency && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {metricCards.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Card key={index} className="group bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-105">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-600 mb-2">{metric.title}</p>
                          <p className="text-3xl font-bold text-slate-800 mb-2">{metric.value}</p>
                          <p className="text-sm text-slate-500">{metric.subtitle}</p>
                        </div>
                        <div className={`p-4 rounded-2xl ${metric.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className={`h-8 w-8 ${metric.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {summaryCards.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Card key={index} className="group bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-105">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-600 mb-2">{metric.title}</p>
                          <p className="text-3xl font-bold text-slate-800 mb-2">{metric.value}</p>
                          <p className="text-sm text-slate-500">{metric.subtitle}</p>
                        </div>
                        <div className={`p-4 rounded-2xl ${metric.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className={`h-8 w-8 ${metric.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Additional Insights */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
                  <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
                    <div className="flex items-center gap-4 mb-4 lg:mb-0">
                      <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-900 text-lg">Customer Acquisition</h4>
                        <p className="text-blue-700 font-medium">
                          {metrics.customersOnboarded} new customers acquired in the selected period
                        </p>
                      </div>
                    </div>
                    <Badge className={`px-4 py-2 rounded-full font-medium ${
                      metrics.customersOnboarded > 0 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    }`}>
                      {metrics.customersOnboarded > 0 ? 'Active' : 'Low'}
                    </Badge>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border border-green-200">
                    <div className="flex items-center gap-4 mb-4 lg:mb-0">
                      <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center">
                        <Percent className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-green-900 text-lg">Sales Performance</h4>
                        <p className="text-green-700 font-medium">
                          {metrics.salesConversionRate}% of customers have made purchases
                        </p>
                      </div>
                    </div>
                    <Badge className={`px-4 py-2 rounded-full font-medium ${
                      metrics.salesConversionRate >= 20 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : 
                      metrics.salesConversionRate >= 10 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 
                      'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                    }`}>
                      {metrics.salesConversionRate >= 20 ? 'Excellent' : 
                       metrics.salesConversionRate >= 10 ? 'Good' : 'Needs Improvement'}
                    </Badge>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 bg-gradient-to-r from-red-50 to-red-100 rounded-2xl border border-red-200">
                    <div className="flex items-center gap-4 mb-4 lg:mb-0">
                      <div className="bg-red-100 rounded-full w-12 h-12 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-red-900 text-lg">Visit Efficiency</h4>
                        <p className="text-red-700 font-medium">
                          {metrics.nonProductiveVisits} non-productive visits recorded
                        </p>
                      </div>
                    </div>
                    <Badge className={`px-4 py-2 rounded-full font-medium ${
                      metrics.nonProductiveVisits === 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' :
                      metrics.nonProductiveVisits <= 5 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 
                      'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                    }`}>
                      {metrics.nonProductiveVisits === 0 ? 'Perfect' :
                       metrics.nonProductiveVisits <= 5 ? 'Good' : 'High'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
                  <div className="bg-indigo-100 rounded-full w-12 h-12 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                  </div>
                  Daily Summary (Expandable)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {loading ? (
                  <p className="text-slate-500">Loading daily summary...</p>
                ) : dailySummaries.length === 0 ? (
                  <p className="text-slate-500">No daily activity found for the selected range.</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {dailySummaries.map((day) => (
                      <AccordionItem key={day.date} value={day.date} className="border-slate-200">
                        <AccordionTrigger className="text-left">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-800">{formatDateLabel(day.date)}</p>
                              <p className="text-xs text-slate-500">{day.date}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                                Customers {day.customersOnboardedDetails.length}
                              </Badge>
                              <Badge className="bg-rose-100 text-rose-700 border border-rose-200">
                                Non-Productive {day.nonProductiveDetails.length}
                              </Badge>
                              <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200">
                                KM {day.totalKm.toLocaleString()}
                              </Badge>
                              <Badge className="bg-orange-100 text-orange-700 border border-orange-200">
                                {formatCurrency(day.totalExpenses)}
                              </Badge>
                              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                                {formatCurrency(day.totalSales)}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Customers Onboarded</h4>
                            {day.customersOnboardedDetails.length === 0 ? (
                              <p className="text-sm text-slate-500">No customers onboarded for this day.</p>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Customer</th>
                                      <th className="px-3 py-2 text-left font-medium">Created By</th>
                                      <th className="px-3 py-2 text-left font-medium">Created At</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.customersOnboardedDetails.map((detail) => (
                                      <tr key={detail.id} className="border-t">
                                        <td className="px-3 py-2 text-slate-700">{detail.name}</td>
                                        <td className="px-3 py-2 text-slate-600">{detail.createdByName}</td>
                                        <td className="px-3 py-2 text-slate-500">
                                          {detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Non-Productive Visits</h4>
                            {day.nonProductiveDetails.length === 0 ? (
                              <p className="text-sm text-slate-500">No non-productive visits for this day.</p>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Customer</th>
                                      <th className="px-3 py-2 text-left font-medium">Reason</th>
                                      <th className="px-3 py-2 text-left font-medium">User</th>
                                      <th className="px-3 py-2 text-left font-medium">Time</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.nonProductiveDetails.map((detail) => (
                                      <tr key={detail.id} className="border-t">
                                        <td className="px-3 py-2 text-slate-700">
                                          {detail.customerName || detail.potentialCustomer || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">{detail.reason}</td>
                                        <td className="px-3 py-2 text-slate-600">{detail.userName}</td>
                                        <td className="px-3 py-2 text-slate-500">
                                          {new Date(detail.createdAt).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Odometer Details</h4>
                            {day.odometerDetails.length === 0 ? (
                              <p className="text-sm text-slate-500">No odometer entries for this day.</p>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">User</th>
                                      <th className="px-3 py-2 text-left font-medium">Clock In</th>
                                      <th className="px-3 py-2 text-left font-medium">Clock Out</th>
                                      <th className="px-3 py-2 text-left font-medium">Total KM</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.odometerDetails.map((detail) => (
                                      <tr key={detail.timeTrackingId} className="border-t">
                                        <td className="px-3 py-2 text-slate-700">{detail.userName}</td>
                                        <td className="px-3 py-2 text-slate-600">
                                          {detail.clockInKm !== null ? detail.clockInKm.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">
                                          {detail.clockOutKm !== null ? detail.clockOutKm.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-700 font-semibold">
                                          {detail.totalKm.toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Other Expenses</h4>
                            {day.expenseDetails.length === 0 ? (
                              <p className="text-sm text-slate-500">No expenses recorded for this day.</p>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Category</th>
                                      <th className="px-3 py-2 text-left font-medium">Amount</th>
                                      <th className="px-3 py-2 text-left font-medium">User</th>
                                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.expenseDetails.map((detail) => (
                                      <tr key={detail.id} className="border-t">
                                        <td className="px-3 py-2 text-slate-700">{detail.category}</td>
                                        <td className="px-3 py-2 text-slate-700 font-semibold">
                                          {formatCurrency(detail.amount)}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">{detail.userName}</td>
                                        <td className="px-3 py-2 text-slate-500">{detail.notes || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Sales Orders</h4>
                            {day.salesOrderDetails.length === 0 ? (
                              <p className="text-sm text-slate-500">No sales orders recorded for this day.</p>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Customer</th>
                                      <th className="px-3 py-2 text-left font-medium">Order #</th>
                                      <th className="px-3 py-2 text-left font-medium">Status</th>
                                      <th className="px-3 py-2 text-left font-medium">Total</th>
                                      <th className="px-3 py-2 text-left font-medium">Created By</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {day.salesOrderDetails.map((detail) => (
                                      <tr key={detail.id} className="border-t">
                                        <td className="px-3 py-2 text-slate-700">{detail.customerName}</td>
                                        <td className="px-3 py-2 text-slate-600">{detail.orderNumber || '-'}</td>
                                        <td className="px-3 py-2 text-slate-600">{detail.status || '-'}</td>
                                        <td className="px-3 py-2 text-slate-700 font-semibold">
                                          {formatCurrency(detail.total)}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">{detail.createdByName}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
        </>
      )}

        {!selectedAgency && user.role === 'superuser' && (
          <Card className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-12 text-center">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Select an Agency</h3>
              <p className="text-slate-600 text-lg">
                Please select an agency from the filters above to view the report data.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EnhancedReports;
