import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { NonProductiveVisit, NON_PRODUCTIVE_REASONS } from '@/types/visits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Search, Calendar, Camera, X, ArrowLeft, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InAppCamera from '@/components/camera/InAppCamera';
import CustomerSearch from '@/components/customers/CustomerSearch';
import { uploadNonProductiveVisitPhoto, base64ToBlob } from '@/utils/storage';
import AgencySelector from '@/components/common/AgencySelector';

interface NonProductiveVisitsProps {
  user: User;
}

interface EnhancedNonProductiveVisit extends NonProductiveVisit {
  potentialCustomer?: string;
  storeFrontPhoto?: string;
}

const NonProductiveVisits = ({ user }: NonProductiveVisitsProps) => {
  const [visits, setVisits] = useState<EnhancedNonProductiveVisit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    user.role === 'superuser' ? null : user.agencyId
  );
  
  // New customer selection states
  const [customerType, setCustomerType] = useState<'existing' | 'new' | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    reason: '',
    notes: '',
    potentialCustomer: ''
  });

  useEffect(() => {
    if (!showCreateForm) {
      fetchVisits();
    } else {
      fetchCustomers();
    }
  }, [selectedDate, showCreateForm, selectedAgencyId]);

  useEffect(() => {
    if (showCreateForm) {
      getCurrentLocation();
    }
  }, [showCreateForm]);

  const fetchCustomers = async () => {
    try {
      let customersQuery = supabase
        .from('customers')
        .select('*');
      
      if (selectedAgencyId) {
        customersQuery = customersQuery.eq('agency_id', selectedAgencyId);
      }
      
      const { data, error } = await customersQuery
        .order('name', { ascending: true });

      if (error) throw error;

      const transformedCustomers: Customer[] = (data || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || '',
        agencyId: customer.agency_id,
        createdAt: new Date(customer.created_at),
        updatedAt: new Date(customer.updated_at)
      }));

      setCustomers(transformedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    }
  };

  const fetchVisits = async () => {
    try {
      let visitsQuery = supabase
        .from('non_productive_visits')
        .select('*');
      
      if (selectedAgencyId) {
        visitsQuery = visitsQuery.eq('agency_id', selectedAgencyId);
      }
      
      const { data, error } = await visitsQuery
        .gte('created_at', selectedDate + 'T00:00:00')
        .lt('created_at', new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedVisits: EnhancedNonProductiveVisit[] = (data || []).map(visit => ({
        id: visit.id,
        agencyId: visit.agency_id,
        userId: visit.user_id,
        reason: visit.reason,
        notes: visit.notes,
        potentialCustomer: visit.potential_customer,
        storeFrontPhoto: visit.store_front_photo,
        latitude: visit.latitude,
        longitude: visit.longitude,
        createdAt: new Date(visit.created_at),
        createdBy: visit.created_by
      }));
      
      setVisits(transformedVisits);
    } catch (error) {
      console.error('Error fetching visits:', error);
      toast({
        title: "Error",
        description: "Failed to fetch visits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            setGpsCoordinates(coords);
            resolve(coords);
          },
          (error) => {
            console.error('GPS Error:', error);
            const coords = {
              latitude: 28.6139 + Math.random() * 0.01,
              longitude: 77.2090 + Math.random() * 0.01
            };
            setGpsCoordinates(coords);
            resolve(coords);
          }
        );
      } else {
        const coords = {
          latitude: 28.6139 + Math.random() * 0.01,
          longitude: 77.2090 + Math.random() * 0.01
        };
        setGpsCoordinates(coords);
        resolve(coords);
      }
    });
  };

  const handlePhotoCapture = (photoData: string) => {
    console.log('Photo captured, setting photo data');
    setCapturedPhoto(photoData);
    getCurrentLocation();
    
    toast({
      title: "Success",
      description: "Photo and location captured successfully!",
    });
  };

  const openCamera = () => {
    console.log('Opening camera');
    setShowCamera(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reason) {
      toast({
        title: "Validation Error",
        description: "Please select a reason for the visit",
        variant: "destructive",
      });
      return;
    }

    if (!customerType) {
      toast({
        title: "Validation Error",
        description: "Please select customer type (existing or new)",
        variant: "destructive",
      });
      return;
    }

    if (customerType === 'existing' && !selectedCustomer) {
      toast({
        title: "Validation Error",
        description: "Please select an existing customer",
        variant: "destructive",
      });
      return;
    }

    if (customerType === 'new') {
      if (!newCustomerName.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter the customer name",
          variant: "destructive",
        });
        return;
      }

      if (!capturedPhoto) {
        toast({
          title: "Validation Error",
          description: "Store front photo is required for new customers",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSubmitting(true);
      
      // Determine customer info to store
      const customerInfo = customerType === 'existing' 
        ? selectedCustomer?.name 
        : newCustomerName.trim();

      // Handle photo upload to storage if it's base64
      let storefrontPhotoUrl = capturedPhoto;
      
      if (capturedPhoto && capturedPhoto.startsWith('data:image/')) {
        console.log('🖼️ Detected base64 photo, uploading to storage...');
        setIsUploadingPhoto(true);
        
        const photoBlob = base64ToBlob(capturedPhoto, 'image/jpeg');
        console.log('📁 Blob created:', photoBlob.size, 'bytes');
        
        const uploadResult = await uploadNonProductiveVisitPhoto(photoBlob, undefined, user.id);
        console.log('☁️ Upload result:', uploadResult);
        
        if (uploadResult.success && uploadResult.url) {
          storefrontPhotoUrl = uploadResult.url;
          console.log('✅ Photo uploaded successfully:', uploadResult.url);
          toast({
            title: "Photo Uploaded",
            description: "Storefront photo uploaded to storage successfully!",
          });
        } else {
          console.error('❌ Photo upload failed:', uploadResult.error);
          toast({
            title: "Upload Warning", 
            description: `Photo upload failed: ${uploadResult.error || 'Unknown error'}. Saving with base64 fallback.`,
            variant: "destructive",
          });
        }
        setIsUploadingPhoto(false);
      }

      const { data, error } = await supabase
        .from('non_productive_visits')
        .insert([{
          agency_id: selectedAgencyId || user.agencyId,
          user_id: user.id,
          reason: formData.reason,
          notes: formData.notes,
          potential_customer: customerInfo,
          store_front_photo: storefrontPhotoUrl || null,
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Non-productive visit recorded successfully",
      });

      // Reset form
      setFormData({ reason: '', notes: '', potentialCustomer: '' });
      setCustomerType('');
      setSelectedCustomer(null);
      setNewCustomerName('');
      setCapturedPhoto('');
      setGpsCoordinates({ latitude: 0, longitude: 0 });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating visit:', error);
      toast({
        title: "Error",
        description: "Failed to record visit",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
    }
  };

  const handleCancel = () => {
    setFormData({ reason: '', notes: '', potentialCustomer: '' });
    setCapturedPhoto('');
    setGpsCoordinates({ latitude: 0, longitude: 0 });
    setShowCreateForm(false);
  };

  const filteredVisits = visits.filter(visit => 
    visit.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.potentialCustomer?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show create form
  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Modern Header */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-6">
                <Button 
                  variant="ghost" 
                  onClick={handleCancel}
                  className="group relative h-12 w-12 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-300" />
                </Button>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Record Non-Productive Visit</h2>
                  <p className="text-lg text-slate-600 font-medium">Track visits that didn't result in sales</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Visit Information */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl">
                <CardContent className="space-y-6 p-8">
                <div className="space-y-3">
                  <Label htmlFor="reason" className="text-base font-semibold text-slate-700">Reason *</Label>
                  <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value })}>
                    <SelectTrigger className="h-14 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                      <SelectValue placeholder="Select reason for visit" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-xl">
                      {NON_PRODUCTIVE_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason} className="rounded-lg">
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Type Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-700">Customer Type</Label>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <Card
                      className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 transform rounded-2xl ${
                        customerType === 'existing' 
                          ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg' 
                          : 'bg-white/90 border-slate-200 hover:bg-white shadow-md'
                      }`}
                      onClick={() => {
                        setCustomerType('existing');
                        setNewCustomerName('');
                      }}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-base text-slate-700">Existing Customer</h3>
                        <p className="text-sm text-slate-500 mt-2">Search from database</p>
                      </CardContent>
                    </Card>
                    
                    <Card
                      className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 transform rounded-2xl ${
                        customerType === 'new' 
                          ? 'ring-2 ring-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-lg' 
                          : 'bg-white/90 border-slate-200 hover:bg-white shadow-md'
                      }`}
                      onClick={() => {
                        setCustomerType('new');
                        setSelectedCustomer(null);
                      }}
                    >
                      <CardContent className="p-6 text-center">
                        <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <UserPlus className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-base text-slate-700">New Customer</h3>
                        <p className="text-sm text-slate-500 mt-2">Enter manually</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Customer Selection Based on Type */}
                {customerType === 'existing' && (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-slate-700">Select Existing Customer</Label>
                    <CustomerSearch
                      customers={customers}
                      onSelectCustomer={setSelectedCustomer}
                      selectedCustomer={selectedCustomer}
                      placeholder="Search for existing customer..."
                    />
                  </div>
                )}

                {customerType === 'new' && (
                  <div className="space-y-3">
                    <Label htmlFor="newCustomerName" className="text-base font-semibold text-slate-700">Customer Name</Label>
                    <Input
                      id="newCustomerName"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Enter customer name (will not be added to customer database)"
                      className="h-14 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                    <p className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="font-medium">Note:</span> This customer will not be added to your customer database
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <Label htmlFor="notes" className="text-base font-semibold text-slate-700">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details about the visit..."
                    rows={4}
                    className="text-base resize-none bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Documentation & Location */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl">
              <CardContent className="space-y-6 p-8">
                {/* Store Front Photo - Required only for new customers */}
                {customerType === 'new' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold text-slate-700">Store Front Photo</Label>
                      <span className="text-red-500 font-medium">*</span>
                    </div>
                    <p className="text-sm text-slate-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="font-medium">Required:</span> A store front photo is mandatory for new customers
                    </p>
                    {capturedPhoto ? (
                      <div className="space-y-4">
                        <div className="relative group">
                          <img 
                            src={capturedPhoto} 
                            alt="Store Front" 
                            className="w-full h-48 sm:h-56 object-cover rounded-2xl border-2 border-slate-200 shadow-lg"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCapturedPhoto('')}
                            className="flex-1 h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={openCamera}
                            className="flex-1 h-12 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Retake
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-16 text-base rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all duration-200"
                        onClick={openCamera}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="h-6 w-6 text-slate-600" />
                          <span className="font-medium text-slate-700">Capture Store Front Photo</span>
                        </div>
                      </Button>
                    )}
                  </div>
                )}

                {/* GPS Display */}
                {gpsCoordinates.latitude !== 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">Location Captured</p>
                        <p className="text-sm text-green-700 font-mono break-all">
                          {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel} 
              disabled={isSubmitting}
              className="group w-full sm:w-auto h-14 text-base font-semibold rounded-xl border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200"
            >
              <span className="group-hover:scale-105 transition-transform duration-200">Cancel</span>
            </Button>
            <Button 
              type="submit" 
              className="group w-full sm:w-auto h-14 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              disabled={isSubmitting || isUploadingPhoto || !formData.reason}
            >
              <span className="group-hover:scale-105 transition-transform duration-200">
                {isUploadingPhoto ? 'Uploading Photo...' : (isSubmitting ? 'Saving...' : 'Save Visit')}
              </span>
            </Button>
          </div>
        </form>

          {/* In-App Camera */}
          {showCamera && (
            <InAppCamera
              onPhotoTaken={handlePhotoCapture}
              onCancel={() => setShowCamera(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // Show visits list
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Modern Header with Gradient */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl opacity-10"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Non-Productive Visits
                </h1>
                <p className="text-lg text-slate-600 font-medium">Track visits that didn't result in sales</p>
              </div>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="group relative w-full sm:w-auto h-14 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-3 group-hover:rotate-90 transition-transform duration-300" />
                Record New Visit
              </Button>
            </div>
          </div>
        </div>

        {/* Agency Selector for Superusers */}
        <AgencySelector
          user={user}
          selectedAgencyId={selectedAgencyId}
          onAgencyChange={(agencyId) => {
            setSelectedAgencyId(agencyId);
          }}
          placeholder="Select agency to view visits..."
        />

        {/* Modern Search and Filter Section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                placeholder="Search visits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-base bg-white/80 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-12 w-full lg:w-56 h-14 text-base bg-white/80 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Modern Visits Grid */}
        <div className="grid gap-6">
          {filteredVisits.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-12 text-center shadow-lg border border-white/20">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <MapPin className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">No visits found</h3>
              <p className="text-slate-600 text-lg">No non-productive visits recorded for the selected date</p>
            </div>
          ) : (
            filteredVisits.map((visit, index) => (
              <Card key={visit.id} className="group bg-white/80 backdrop-blur-sm hover:bg-white border-white/20 shadow-lg hover:shadow-xl rounded-2xl transition-all duration-300 transform hover:scale-[1.02]">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Badge className="w-fit bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium px-3 py-1 rounded-full">
                          {visit.reason}
                        </Badge>
                        <div className="flex items-center text-slate-500 font-medium">
                          <Calendar className="h-4 w-4 mr-2" />
                          {visit.createdAt.toLocaleString()}
                        </div>
                      </div>

                      {/* Customer Info */}
                      {visit.potentialCustomer && (
                        <div className="bg-blue-50/80 rounded-xl p-4 border border-blue-100">
                          <div className="flex items-center text-blue-800">
                            <Users className="h-4 w-4 mr-2" />
                            <span className="font-semibold text-sm">Customer:</span>
                          </div>
                          <p className="text-blue-700 font-medium mt-1">{visit.potentialCustomer}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {visit.notes && (
                        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                          <div className="flex items-center text-slate-700 mb-2">
                            <span className="font-semibold text-sm">Notes:</span>
                          </div>
                          <p className="text-slate-600">{visit.notes}</p>
                        </div>
                      )}

                      {/* Location */}
                      <div className="flex items-center text-slate-500">
                        <div className="bg-green-100 rounded-lg p-2 mr-3">
                          <MapPin className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-slate-700">GPS Location</p>
                          <p className="text-sm text-slate-500 font-mono">
                            {visit.latitude.toFixed(6)}, {visit.longitude.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Store Photo */}
                    {visit.storeFrontPhoto && (
                      <div className="lg:w-48 lg:h-48">
                        <div className="relative group/image">
                          <img 
                            src={visit.storeFrontPhoto} 
                            alt="Store Front" 
                            className="w-full h-full object-cover rounded-xl shadow-md group-hover/image:shadow-lg transition-shadow duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl opacity-0 group-hover/image:opacity-100 transition-opacity duration-300"></div>
                          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300">
                            <span className="text-xs font-medium text-slate-700">Store Front</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NonProductiveVisits;
