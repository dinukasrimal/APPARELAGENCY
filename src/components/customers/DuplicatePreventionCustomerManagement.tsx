import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { useAgencies } from '@/hooks/useAgency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, MapPin, Phone, Building, AlertTriangle, Eye, Filter, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CustomerForm from './CustomerForm';
import CustomerInvoiceDetails from './CustomerInvoiceDetails';
import { uploadCustomerPhoto, base64ToBlob } from '@/utils/storage';
import ImageModal from '@/components/ui/image-modal';

interface CustomerManagementProps {
  user: User;
}

const DuplicatePreventionCustomerManagement = ({ user }: CustomerManagementProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [duplicateCheck, setDuplicateCheck] = useState<string>('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const { agencies } = useAgencies(); // Fetch all agencies for name lookup
  const { toast } = useToast();

  // Helper function to get agency name by ID
  const getAgencyName = (agencyId: string) => {
    const agency = agencies.find(a => a.id === agencyId);
    return agency?.name || agencyId;
  };

  // Handle image click to open modal
  const handleImageClick = (imageUrl: string, customerName: string) => {
    setSelectedImage({ url: imageUrl, title: `${customerName} - Storefront Photo` });
    setImageModalOpen(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
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

  const checkForDuplicates = async (phone: string, agencyId: string, excludeId?: string) => {
    try {
      let query = supabase
        .from('customers')
        .select('id, name, phone')
        .eq('phone', phone)
        .eq('agency_id', agencyId);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking for duplicates:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }
  };

  const handleAddCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => {
    try {
      console.log('🆕 UPDATED CODE: Adding customer:', customerData);
      console.log('🖼️ Photo data:', customerData.storefrontPhoto?.substring(0, 50));
      
      const agencyId = user.agencyId || '00000000-0000-0000-0000-000000000000';
      
      // Check for duplicates before adding
      const isDuplicate = await checkForDuplicates(customerData.phone, agencyId);
      
      if (isDuplicate) {
        toast({
          title: "Duplicate Customer",
          description: "A customer with this phone number already exists in your agency.",
          variant: "destructive",
        });
        return;
      }

      // Handle photo upload to storage if it's base64
      let storefrontPhotoUrl = customerData.storefrontPhoto;
      
      if (customerData.storefrontPhoto && customerData.storefrontPhoto.startsWith('data:image/')) {
        console.log('Detected base64 photo, uploading to storage...');
        
        const photoBlob = base64ToBlob(customerData.storefrontPhoto, 'image/jpeg');
        console.log('Blob created:', photoBlob.size, 'bytes');
        
        const uploadResult = await uploadCustomerPhoto(photoBlob);
        console.log('Upload result:', uploadResult);
        
        if (uploadResult.success && uploadResult.url) {
          storefrontPhotoUrl = uploadResult.url;
          console.log('Photo uploaded successfully:', uploadResult.url);
          toast({
            title: "Photo Uploaded",
            description: "Customer photo uploaded to storage successfully!",
          });
        } else {
          console.error('Photo upload failed:', uploadResult.error);
          toast({
            title: "Upload Warning", 
            description: `Photo upload failed: ${uploadResult.error || 'Unknown error'}. Saving with base64 fallback.`,
            variant: "destructive",
          });
        }
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          storefront_photo: storefrontPhotoUrl,
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
        
        // Check if it's a unique constraint violation
        if (error.code === '23505' && error.message.includes('unique_customer_phone_per_agency')) {
          toast({
            title: "Duplicate Customer",
            description: "A customer with this phone number already exists in your agency.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: `Failed to add customer: ${error.message}`,
            variant: "destructive",
          });
        }
        return;
      }

      console.log('Customer added successfully:', data);
      toast({
        title: "Success",
        description: "Customer added successfully!",
      });

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

  const handleUpdateCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!editingCustomer) return;

    try {
      console.log('🔄 UPDATED CODE: Updating customer:', editingCustomer.id, customerData);
      console.log('🖼️ Photo data:', customerData.storefrontPhoto?.substring(0, 50));
      
      // Check for duplicates before updating (excluding current customer)
      const isDuplicate = await checkForDuplicates(
        customerData.phone, 
        editingCustomer.agencyId, 
        editingCustomer.id
      );
      
      if (isDuplicate) {
        toast({
          title: "Duplicate Customer",
          description: "Another customer with this phone number already exists in your agency.",
          variant: "destructive",
        });
        return;
      }

      // Handle photo upload to storage if it's base64
      let storefrontPhotoUrl = customerData.storefrontPhoto;
      
      if (customerData.storefrontPhoto && customerData.storefrontPhoto.startsWith('data:image/')) {
        console.log('Detected base64 photo, uploading to storage...');
        
        const photoBlob = base64ToBlob(customerData.storefrontPhoto, 'image/jpeg');
        console.log('Blob created:', photoBlob.size, 'bytes');
        
        const uploadResult = await uploadCustomerPhoto(photoBlob, editingCustomer.id);
        console.log('Upload result:', uploadResult);
        
        if (uploadResult.success && uploadResult.url) {
          storefrontPhotoUrl = uploadResult.url;
          console.log('Photo uploaded successfully:', uploadResult.url);
          toast({
            title: "Photo Uploaded",
            description: "Customer photo uploaded to storage successfully!",
          });
        } else {
          console.error('Photo upload failed:', uploadResult.error);
          toast({
            title: "Upload Warning", 
            description: `Photo upload failed: ${uploadResult.error || 'Unknown error'}. Saving with base64 fallback.`,
            variant: "destructive",
          });
        }
      }

      const { error } = await supabase
        .from('customers')
        .update({
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
          storefront_photo: storefrontPhotoUrl,
          signature: customerData.signature,
          latitude: customerData.gpsCoordinates.latitude,
          longitude: customerData.gpsCoordinates.longitude,
        })
        .eq('id', editingCustomer.id);

      if (error) {
        console.error('Error updating customer:', error);
        
        // Check if it's a unique constraint violation
        if (error.code === '23505' && error.message.includes('unique_customer_phone_per_agency')) {
          toast({
            title: "Duplicate Customer",
            description: "Another customer with this phone number already exists in your agency.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to update customer. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

      console.log('Customer updated successfully');
      toast({
        title: "Success",
        description: "Customer updated successfully!",
      });

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

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
            <p className="text-gray-600">Loading customers...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Add a quick duplicate check function for the search
  const handleDuplicateCheck = async () => {
    if (!duplicateCheck.trim()) return;
    
    const agencyId = user.agencyId || '00000000-0000-0000-0000-000000000000';
    const isDuplicate = await checkForDuplicates(duplicateCheck, agencyId);
    
    if (isDuplicate) {
      toast({
        title: "Duplicate Found",
        description: "A customer with this phone number already exists.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "No Duplicate",
        description: "This phone number is available.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
          <p className="text-gray-600 flex items-center gap-2">
            {user.role === 'superuser' ? `All customers across agencies (${customers.length} total)` : 'Your agency customers'}
            <Badge variant="secondary" className="bg-green-100 text-green-800 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Duplicate Protection
            </Badge>
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Duplicate Check Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5" />
            Quick Duplicate Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Enter phone number to check for duplicates..."
              value={duplicateCheck}
              onChange={(e) => setDuplicateCheck(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleDuplicateCheck} variant="outline">
              Check Duplicate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search customers by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Agency Filter for Superuser */}
        {user.role === 'superuser' && (
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
            <Select value={selectedAgencyFilter} onValueChange={setSelectedAgencyFilter}>
              <SelectTrigger className="pl-10">
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

      {/* Customer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <Card 
            key={customer.id} 
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  {/* Storefront Photo Thumbnail */}
                  {customer.storefrontPhoto ? (
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => handleImageClick(customer.storefrontPhoto!, customer.name)}
                    >
                      <img
                        src={customer.storefrontPhoto}
                        alt={`${customer.name} storefront`}
                        className="w-12 h-12 object-cover rounded border-2 border-gray-200 group-hover:border-blue-400 transition-colors"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded border-2 border-gray-200 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    {customer.storefrontPhoto && (
                      <p className="text-xs text-gray-500 mt-1">Click photo to enlarge</p>
                    )}
                  </div>
                </div>
                {user.role === 'superuser' && (
                  <Badge variant="secondary" className="text-xs">
                    {getAgencyName(customer.agencyId)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                {customer.phone}
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{customer.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building className="h-4 w-4" />
                <span>Added {customer.createdAt.toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewCustomer(customer)}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditCustomer(customer)}
                  className="flex items-center gap-1"
                >
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCustomers.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
          </p>
          {!searchTerm && (
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          )}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          isOpen={imageModalOpen}
          onClose={closeImageModal}
          imageUrl={selectedImage.url}
          title={selectedImage.title}
        />
      )}
    </div>
  );
};

export default DuplicatePreventionCustomerManagement;
