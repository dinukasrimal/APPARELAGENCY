
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, ShoppingCart, AlertTriangle, Download, TrendingUp, Percent } from 'lucide-react';
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

interface EnhancedReportsProps {
  user: User;
}

const EnhancedReports = ({ user }: EnhancedReportsProps) => {
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
      fetchReportMetrics();
    }
  }, [selectedAgency, startDate, endDate]);

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

  const fetchReportMetrics = async () => {
    setLoading(true);
    try {
      const startDateTime = startDate + 'T00:00:00';
      const endDateTime = endDate + 'T23:59:59';

      // Fetch customers onboarded in the date range
      const { count: customersOnboarded } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', selectedAgency)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      // Fetch total customers for the agency (all time)
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', selectedAgency);

      // Fetch customers who have made sales orders
      const { data: customersWithSalesData } = await supabase
        .from('sales_orders')
        .select('customer_id')
        .eq('agency_id', selectedAgency)
        .not('customer_id', 'is', null);

      const uniqueCustomersWithSales = new Set(
        customersWithSalesData?.map(order => order.customer_id) || []
      ).size;

      // Calculate conversion rate
      const salesConversionRate = totalCustomers > 0 
        ? (uniqueCustomersWithSales / totalCustomers) * 100 
        : 0;

      // Fetch non-productive visits in the date range
      const { count: nonProductiveVisits } = await supabase
        .from('non_productive_visits')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', selectedAgency)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      // Fetch total sales orders in the date range
      const { count: totalSalesOrders } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', selectedAgency)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      setMetrics({
        customersOnboarded: customersOnboarded || 0,
        salesConversionRate: Math.round(salesConversionRate * 100) / 100,
        totalCustomers: totalCustomers || 0,
        customersWithSales: uniqueCustomersWithSales,
        nonProductiveVisits: nonProductiveVisits || 0,
        totalSalesOrders: totalSalesOrders || 0
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

  const exportToCSV = () => {
    const selectedAgencyName = agencies.find(a => a.id === selectedAgency)?.name || 'Unknown Agency';
    const headers = ['Metric', 'Value', 'Period', 'Agency'];
    const csvData = [
      ['Customers Onboarded', metrics.customersOnboarded.toString(), `${startDate} to ${endDate}`, selectedAgencyName],
      ['Total Customers', metrics.totalCustomers.toString(), 'All Time', selectedAgencyName],
      ['Customers with Sales Orders', metrics.customersWithSales.toString(), 'All Time', selectedAgencyName],
      ['Sales Conversion Rate (%)', metrics.salesConversionRate.toString(), 'All Time', selectedAgencyName],
      ['Non-Productive Visits', metrics.nonProductiveVisits.toString(), `${startDate} to ${endDate}`, selectedAgencyName],
      ['Sales Orders Created', metrics.totalSalesOrders.toString(), `${startDate} to ${endDate}`, selectedAgencyName]
    ];

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced-report-${startDate}-to-${endDate}.csv`;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Modern Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Enhanced Reports</h2>
                <p className="text-lg text-slate-600 font-medium">Comprehensive analytics with date range selection</p>
              </div>
              
              <Button 
                onClick={exportToCSV} 
                disabled={loading || !selectedAgency}
                className="group relative w-full sm:w-auto h-14 px-8 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Download className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                Export CSV
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
                  onClick={fetchReportMetrics} 
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
