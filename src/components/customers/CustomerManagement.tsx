import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { useAgencies } from '@/hooks/useAgency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, MapPin, Phone, Building, Eye, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CustomerForm from './CustomerForm';
import CustomerInvoiceDetails from './CustomerInvoiceDetails';

interface CustomerManagementProps {
  user: User;
}

const CustomerManagement = ({ user }: CustomerManagementProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { agencies } = useAgencies(); // Fetch all agencies for name lookup
  const { toast } = useToast();

  // Helper function to get agency name by ID
  const getAgencyName = (agencyId: string) => {
    const agency = agencies.find(a => a.id === agencyId);
    return agency?.name || agencyId;
  };

  // Load customers from database on component mount
  useEffect(() => {
    loadCustomers();
  }, [user]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      console.log('Loading customers for user:', user);
      
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      // Only filter by agency if not superuser
      if (user.role !== 'superuser' && user.agencyId) {
        query = query.eq('agency_id', user.agencyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading customers:', error);
        toast({
          title: "Error",
          description: "Failed to load customers. Please try again.",
          variant: "destructive",
        });
        return;
      }

      console.log('Loaded customers from database:', data);
      
      // Transform database data to match Customer interface
      const transformedCustomers: Customer[] = (data || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        storefrontPhoto: customer.storefront_photo || undefined,
        signature: customer.signature || undefined,
        gpsCoordinates: {
          latitude: customer.latitude || 0,
          longitude: customer.longitude || 0
        },
        agencyId: customer.agency_id,
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by || ''
      }));

      console.log('Transformed customers:', transformedCustomers);
      setCustomers(transformedCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter customers based on search term and selected agency (for superuser)
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm);
    
    const matchesAgency = selectedAgencyFilter === 'all' || customer.agencyId === selectedAgencyFilter;
    
    return matchesSearch && matchesAgency;
  });

  const handleAddCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => {
    try {
      console.log('Adding customer:', customerData);
      
      // Use the user's agency ID or a default one
      const agencyId = user.agencyId || '00000000-0000-0000-0000-000000000000';
      
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          storefront_photo: customerData.storefrontPhoto,
          signature: customerData.signature,
          latitude: customerData.gpsCoordinates.latitude,
          longitude: customerData.gpsCoordinates.longitude,
          agency_id: agencyId,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding customer:', error);
        toast({
          title: "Error",
          description: `Failed to add customer: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Customer added successfully:', data);
      toast({
        title: "Success",
        description: "Customer added successfully!",
      });

      // Reload customers to get the latest data
      await loadCustomers();
      setShowForm(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleUpdateCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!editingCustomer) return;

    try {
      console.log('Updating customer:', editingCustomer.id, customerData);
      
      const { error } = await supabase
        .from('customers')
        .update({
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          storefront_photo: customerData.storefrontPhoto,
          signature: customerData.signature,
          latitude: customerData.gpsCoordinates.latitude,
          longitude: customerData.gpsCoordinates.longitude,
        })
        .eq('id', editingCustomer.id);

      if (error) {
        console.error('Error updating customer:', error);
        toast({
          title: "Error",
          description: "Failed to update customer. Please try again.",
          variant: "destructive",
        });
        return;
      }

      console.log('Customer updated successfully');
      toast({
        title: "Success",
        description: "Customer updated successfully!",
      });

      // Reload customers to get the latest data
      await loadCustomers();
      setShowForm(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: "Failed to update customer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  if (selectedCustomer) {
    return (
      <CustomerInvoiceDetails
        user={user}
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  if (showForm) {
    return (
      <CustomerForm
        user={user}
        customer={editingCustomer}
        onSubmit={editingCustomer ? handleUpdateCustomer : handleAddCustomer}
        onCancel={handleCloseForm}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Modern Loading Header */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Customer Management</h2>
                  <p className="text-lg text-slate-600 font-medium">Loading customers...</p>
                </div>
                <div className="w-32 h-14 bg-slate-200 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
          
          {/* Modern Loading Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl animate-pulse">
                <CardHeader className="pb-4">
                  <div className="h-6 bg-slate-200 rounded-lg w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                      <div className="h-4 bg-slate-200 rounded flex-1"></div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                      <div className="h-4 bg-slate-200 rounded flex-1"></div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                      <div className="h-4 bg-slate-200 rounded flex-1"></div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <div className="h-11 bg-slate-200 rounded-xl flex-1"></div>
                      <div className="h-11 bg-slate-200 rounded-xl flex-1"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Modern Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Customer Management</h2>
                <p className="text-lg text-slate-600 font-medium">
                  {user.role === 'superuser' ? (
                    <span className="flex items-center gap-2">
                      All customers across agencies 
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium px-3 py-1 rounded-full">
                        {filteredCustomers.length} total
                      </Badge>
                    </span>
                  ) : (
                    'Manage your agency customers'
                  )}
                </p>
              </div>
              <Button 
                onClick={() => setShowForm(true)} 
                className="group relative w-full sm:w-auto h-14 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                Add Customer
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Search and Filter */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                placeholder="Search customers by name, phone, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Agency Filter for Superuser */}
            {user.role === 'superuser' && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-20">
                  <Filter className="h-5 w-5 text-slate-400" />
                </div>
                <Select value={selectedAgencyFilter} onValueChange={setSelectedAgencyFilter}>
                  <SelectTrigger className="pl-12 h-14 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                    <SelectValue placeholder="Filter by agency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agencies</SelectItem>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Modern Customer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer, index) => (
            <Card 
              key={customer.id} 
              className="group bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-105"
              style={{
                animationDelay: `${index * 100}ms`
              }}
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors duration-200">
                    {customer.name}
                  </CardTitle>
                  {user.role === 'superuser' && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium px-3 py-1 rounded-full text-xs">
                      {getAgencyName(customer.agencyId)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-blue-800 font-medium">{customer.phone}</span>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="bg-green-100 rounded-full w-8 h-8 flex items-center justify-center mt-0.5">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-green-800 font-medium line-clamp-2 flex-1">{customer.address}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center">
                      <Building className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="text-slate-700 font-medium">
                      Added {customer.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleViewCustomer(customer)}
                    className="group/btn flex-1 h-11 bg-white/90 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-xl transition-all duration-200"
                  >
                    <Eye className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform duration-200" />
                    View Details
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleEditCustomer(customer)}
                    className="group/btn flex-1 h-11 text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all duration-200"
                  >
                    <span className="group-hover/btn:scale-105 transition-transform duration-200">
                      Edit
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && !loading && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-white/20">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Building className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">No customers found</h3>
            <p className="text-slate-600 text-lg mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setShowForm(true)} 
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add First Customer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerManagement;
