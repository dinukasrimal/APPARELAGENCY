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

interface CustomerEngagementData {
  customer: Customer;
  agencyName?: string;
  hasInvoices: boolean;
  invoiceCount: number;
  totalInvoiceAmount: number;
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
  const { toast } = useToast();

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
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
      let customersQuery = supabase
        .from('customers')
        .select('*');
      
      if (selectedAgencyId) {
        customersQuery = customersQuery.eq('agency_id', selectedAgencyId);
      }
      
      const { data: customersData, error: customersError } = await customersQuery
        .order('name');

      if (customersError) throw customersError;

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

      // Fetch invoices for the date range
      let invoicesQuery = supabase
        .from('invoices')
        .select('*');
      
      if (selectedAgencyId) {
        invoicesQuery = invoicesQuery.eq('agency_id', selectedAgencyId);
      }
      
      const { data: invoicesData, error: invoicesError } = await invoicesQuery
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`);

      if (invoicesError) throw invoicesError;

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

          return {
            customer,
            agencyName: agencyMap[customer.agencyId] || undefined,
            hasInvoices: customerInvoices.length > 0,
            invoiceCount: customerInvoices.length,
            totalInvoiceAmount: customerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
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