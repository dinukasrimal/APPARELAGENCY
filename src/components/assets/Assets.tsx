import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertCircle, Camera, MapPin, Package, Plus, Search, Calendar, User as UserIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InAppCamera from '@/components/camera/InAppCamera';
import CustomerSearch from '@/components/customers/CustomerSearch';
import { Customer } from '@/types/customer';

interface Asset {
  id: string;
  customer_id: string;
  asset_type: string;
  description: string;
  photo_url: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  given_by: string;
  customer?: Customer;
}

interface AssetsProps {
  user: User;
}

const Assets = memo(({ user }: AssetsProps) => {
  console.log('Assets component mounting with user:', user);
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [assetType, setAssetType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photo, setPhoto] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterAssetType, setFilterAssetType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const photoRef = useRef<string>(''); // Backup reference for photo data
  const { toast } = useToast();

  // localStorage keys for persisting data
  const PHOTO_STORAGE_KEY = `assets_photo_${user.id}`;
  const DIALOG_STATE_KEY = `assets_dialog_${user.id}`;
  const FORM_DATA_KEY = `assets_form_${user.id}`;

  // Save photo to localStorage
  const savePhotoToStorage = (photoData: string) => {
    try {
      localStorage.setItem(PHOTO_STORAGE_KEY, photoData);
      console.log('Assets: Photo saved to localStorage, length:', photoData.length);
    } catch (error) {
      console.error('Assets: Failed to save photo to localStorage:', error);
    }
  };

  // Load photo from localStorage
  const loadPhotoFromStorage = (): string => {
    try {
      const savedPhoto = localStorage.getItem(PHOTO_STORAGE_KEY) || '';
      console.log('Assets: Photo loaded from localStorage, length:', savedPhoto.length);
      return savedPhoto;
    } catch (error) {
      console.error('Assets: Failed to load photo from localStorage:', error);
      return '';
    }
  };

  // Clear photo from localStorage
  const clearPhotoFromStorage = () => {
    try {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
      console.log('Assets: Photo cleared from localStorage');
    } catch (error) {
      console.error('Assets: Failed to clear photo from localStorage:', error);
    }
  };

  // Save dialog and form state to localStorage
  const saveFormStateToStorage = () => {
    try {
      const formState = {
        dialogOpen,
        assetType,
        description,
        selectedCustomerId: selectedCustomer?.id || null,
        latitude,
        longitude
      };
      
      // Force dialog to be open if we have photo data
      const hasPhoto = photo || photoRef.current;
      const shouldKeepDialogOpen = dialogOpen || hasPhoto;
      
      localStorage.setItem(FORM_DATA_KEY, JSON.stringify(formState));
      localStorage.setItem(DIALOG_STATE_KEY, JSON.stringify({ dialogOpen: shouldKeepDialogOpen }));
      console.log('Assets: Form and dialog state saved to localStorage, forcedOpen:', shouldKeepDialogOpen);
    } catch (error) {
      console.error('Assets: Failed to save form state to localStorage:', error);
    }
  };

  // Load dialog and form state from localStorage
  const loadFormStateFromStorage = () => {
    try {
      const dialogStateStr = localStorage.getItem(DIALOG_STATE_KEY);
      const formStateStr = localStorage.getItem(FORM_DATA_KEY);
      
      if (dialogStateStr) {
        const dialogState = JSON.parse(dialogStateStr);
        console.log('Assets: Restoring dialog state:', dialogState);
        if (dialogState.dialogOpen) {
          setDialogOpen(true);
        }
      }
      
      if (formStateStr) {
        const formState = JSON.parse(formStateStr);
        console.log('Assets: Restoring form state:', formState);
        
        if (formState.assetType) setAssetType(formState.assetType);
        if (formState.description) setDescription(formState.description);
        if (formState.latitude) setLatitude(formState.latitude);
        if (formState.longitude) setLongitude(formState.longitude);
        
        // We'll handle customer restoration separately since it needs the customers array
        return formState;
      }
    } catch (error) {
      console.error('Assets: Failed to load form state from localStorage:', error);
    }
    return null;
  };

  // Clear all localStorage data
  const clearAllStorageData = () => {
    try {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
      localStorage.removeItem(DIALOG_STATE_KEY);
      localStorage.removeItem(FORM_DATA_KEY);
      console.log('Assets: All storage data cleared');
    } catch (error) {
      console.error('Assets: Failed to clear storage data:', error);
    }
  };

  const assetTypes = [
    'Rack',
    'Banner',
    'Display Stand',
    'Poster',
    'Brochure Holder',
    'Signage',
    'Promotional Material',
    'Other'
  ];

  useEffect(() => {
    // Test database connection first
    testDatabaseConnection();
    fetchCustomers();
    fetchAssets();
    
    // Load photo from localStorage if it exists
    const savedPhoto = loadPhotoFromStorage();
    if (savedPhoto) {
      setPhoto(savedPhoto);
      photoRef.current = savedPhoto;
      console.log('Assets: Restored photo from localStorage on mount');
    }
    
    // Load form and dialog state from localStorage
    const formState = loadFormStateFromStorage();
    
    // If we have a photo but dialog is closed, reopen it (recovery from re-mount)
    setTimeout(() => {
      const currentPhoto = loadPhotoFromStorage();
      if (currentPhoto && !dialogOpen) {
        console.log('Assets: Found orphaned photo, reopening dialog for recovery');
        setDialogOpen(true);
      }
    }, 500);
  }, []);

  const testDatabaseConnection = async () => {
    try {
      console.log('Assets: Testing database connection to customer_assets table...');
      
      // Test 1: Check if table exists and is accessible
      const { data: tableTest, error: tableError } = await supabase
        .from('customer_assets')
        .select('count')
        .limit(0);
        
      console.log('Assets: Table access test result:', { tableTest, tableError });
      
      if (tableError) {
        console.error('Assets: Database table access failed:', tableError);
        toast({
          title: "Database Error",
          description: `Cannot access customer_assets table: ${tableError.message}`,
          variant: "destructive",
        });
        return;
      }
      
      // Test 2: Check RLS policies by trying a simple select
      const { data: policyTest, error: policyError } = await supabase
        .from('customer_assets')
        .select('id')
        .limit(1);
        
      console.log('Assets: RLS policy test result:', { policyTest, policyError });
      
      if (policyError) {
        console.error('Assets: RLS policy test failed:', policyError);
        toast({
          title: "Permission Error", 
          description: `Database access restricted: ${policyError.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Assets: Database connection and RLS policies working correctly');
      }
    } catch (error) {
      console.error('Assets: Database connection test failed:', error);
      toast({
        title: "Database Error",
        description: "Failed to connect to database",
        variant: "destructive",
      });
    }
  };

  // Debug photo state changes and restore from ref if lost
  useEffect(() => {
    console.log('Assets: Photo state changed, photo length:', photo ? photo.length : 0);
    console.log('Assets: Photo ref has data:', photoRef.current ? photoRef.current.length : 0);
    
    // If photo state is empty but ref has data, restore it
    if (!photo && photoRef.current) {
      console.log('Assets: Restoring photo from ref');
      setPhoto(photoRef.current);
    }
  }, [photo]);

  // Save form state whenever it changes
  useEffect(() => {
    saveFormStateToStorage();
  }, [dialogOpen, assetType, description, selectedCustomer, latitude, longitude]);

  const fetchCustomers = async () => {
    try {
      console.log('Assets: Fetching customers for user:', user);
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, address, phone, secondary_phone, agency_id, latitude, longitude, created_at, created_by')
        .order('name');

      if (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: "Error",
          description: "Failed to fetch customers",
          variant: "destructive",
        });
        return;
      }

      console.log('Assets: Customers fetched:', data?.length || 0);
      
      // Transform database data to match Customer interface
      const transformedCustomers: Customer[] = (data || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        secondaryPhone: customer.secondary_phone || undefined,
        address: customer.address,
        agencyId: customer.agency_id,
        gpsCoordinates: {
          latitude: customer.latitude || 0,
          longitude: customer.longitude || 0
        },
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by || ''
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

  const fetchAssets = async () => {
    try {
      setLoading(true);
      console.log('Assets: Fetching assets for user:', user);
      const { data, error } = await supabase
        .from('customer_assets')
        .select(`
          *,
          customer:customers(id, name, address, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching assets:', error);
        toast({
          title: "Error",
          description: "Failed to fetch assets",
          variant: "destructive",
        });
        return;
      }

      console.log('Assets: Assets fetched:', data?.length || 0);
      setAssets(data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          toast({
            title: "Location captured",
            description: `Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}`,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Location Error",
            description: "Failed to get current location. Please ensure location services are enabled.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Location Not Supported",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setAssetType('');
    setDescription('');
    setPhoto('');
    photoRef.current = ''; // Clear ref backup too
    setLatitude(null);
    setLongitude(null);
    clearAllStorageData(); // Clear all localStorage data
  };

  const handleDialogOpenChange = (open: boolean) => {
    console.log('Assets: handleDialogOpenChange called with:', open);
    console.trace('Assets: Dialog open change stack trace');
    setDialogOpen(open);
    if (open) {
      resetForm(); // Reset form when opening dialog
    }
  };

  const handlePhotoTaken = useCallback((photoData: string) => {
    console.log('Assets: handlePhotoTaken called with photo data length:', photoData.length);
    
    // Ensure we have valid photo data
    if (!photoData || !photoData.startsWith('data:image/')) {
      console.error('Assets: Invalid photo data received');
      toast({
        title: "Photo Error",
        description: "Invalid photo data received",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Assets: Setting photo state with data length:', photoData.length);
    photoRef.current = photoData; // Store in ref as backup
    savePhotoToStorage(photoData); // Save to localStorage
    setPhoto(photoData);
    console.log('Assets: photo state updated, stored in ref and localStorage');
    
    // Use setTimeout to ensure state update completes before closing camera
    setTimeout(() => {
      console.log('Assets: closing camera');
      setShowCamera(false);
      getCurrentLocation();
      console.log('Assets: getCurrentLocation called');
      
      // Ensure dialog stays open after photo is taken
      setTimeout(() => {
        if (!dialogOpen) {
          console.log('Assets: Reopening dialog after photo taken');
          setDialogOpen(true);
        }
      }, 200);
    }, 100);
  }, [toast]); // Include toast in dependencies

  const handleAddAsset = async () => {
    console.log('handleAddAsset called');
    console.log('Form data:', { selectedCustomer, assetType, description, photo: !!photo, latitude, longitude });
    
    if (!selectedCustomer || !assetType || !description || !photo) {
      console.log('Validation failed - missing fields');
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and take a photo.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting asset insertion...');
      setSaving(true);

      const assetData = {
        customer_id: selectedCustomer.id,
        asset_type: assetType,
        description: description,
        photo_url: photo,
        latitude: latitude,
        longitude: longitude,
        given_by: user.name,
      };
      
      console.log('Asset data to insert:', assetData);
      console.log('User details:', { userId: user.id, userAgencyId: user.agencyId, userName: user.name });
      console.log('Selected customer details:', { 
        customerId: selectedCustomer.id, 
        customerName: selectedCustomer.name,
        customerAgencyId: selectedCustomer.agencyId
      });
      
      // Check if customer belongs to user's agency
      if (selectedCustomer.agencyId !== user.agencyId && user.role !== 'superuser') {
        console.error('Agency mismatch - Customer agency:', selectedCustomer.agencyId, 'User agency:', user.agencyId);
        toast({
          title: "Permission Error",
          description: "You can only add assets to customers in your agency",
          variant: "destructive",
        });
        return;
      }

      // Test database connection first
      console.log('Testing database connection...');
      const { data: testData, error: testError } = await supabase
        .from('customer_assets')
        .select('id')
        .limit(1);
      
      console.log('Database test result:', { testData, testError });

      const { data, error } = await supabase
        .from('customer_assets')
        .insert([assetData])
        .select(`
          *,
          customer:customers(id, name, address, phone)
        `);

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error details:', error);
        toast({
          title: "Database Error",
          description: `Failed to add asset: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!data || data.length === 0) {
        console.error('No data returned from insert');
        toast({
          title: "Error",
          description: "No data returned from database",
          variant: "destructive",
        });
        return;
      }

      console.log('Asset added successfully:', data);
      toast({
        title: "Asset Added",
        description: "Asset has been successfully added to the customer.",
      });

      setAssets(prev => [...(data || []), ...prev]);
      
      // Clear all form data and storage
      setSelectedCustomer(null);
      setAssetType('');
      setDescription('');
      setPhoto('');
      photoRef.current = '';
      setLatitude(null);
      setLongitude(null);
      setDialogOpen(false);
      clearAllStorageData(); // Clear all localStorage data
    } catch (error) {
      console.error('Catch block error:', error);
      toast({
        title: "Error",
        description: `Failed to add asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      console.log('Setting saving to false');
      setSaving(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.asset_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.customer?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCustomer = filterCustomer === '' || filterCustomer === 'all' || asset.customer_id === filterCustomer;
    const matchesAssetType = filterAssetType === '' || filterAssetType === 'all' || asset.asset_type === filterAssetType;
    
    return matchesSearch && matchesCustomer && matchesAssetType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assets...</p>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Assets</h1>
          <p className="text-gray-600">Manage assets given to customers</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer *</Label>
                <CustomerSearch
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                  onCustomerChange={() => setSelectedCustomer(null)}
                />
              </div>

              <div>
                <Label htmlFor="assetType">Asset Type *</Label>
                <Select value={assetType} onValueChange={setAssetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the asset..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <Label>Photo *</Label>
                <div className="space-y-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCamera(true)}
                    className="w-full flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                  {photo && (
                    <div className="mt-2">
                      <img 
                        src={photo} 
                        alt="Asset preview" 
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <p className="text-xs text-gray-500 mt-1">Photo captured (Length: {photo.length})</p>
                    </div>
                  )}
                  {!photo && (
                    <p className="text-xs text-gray-500 mt-1">No photo taken yet</p>
                  )}
                </div>
              </div>

              {latitude && longitude && (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    Location captured: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    console.log('Add Asset button clicked');
                    handleAddAsset();
                  }} 
                  disabled={saving}
                  className="flex-1"
                  type="button"
                >
                  {saving ? 'Adding...' : 'Add Asset'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setDialogOpen(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAssetType} onValueChange={setFilterAssetType}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by asset type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All asset types</SelectItem>
            {assetTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssets.map((asset) => (
          <Card key={asset.id} className="overflow-hidden">
            <div className="aspect-video bg-gray-100 relative">
              <img 
                src={asset.photo_url} 
                alt={asset.description}
                className="w-full h-full object-cover"
              />
              <Badge className="absolute top-2 right-2 bg-white text-black">
                {asset.asset_type}
              </Badge>
            </div>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{asset.asset_type}</span>
                </div>
                
                <p className="text-sm text-gray-600">{asset.description}</p>
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <UserIcon className="h-3 w-3" />
                  <span>{asset.customer?.name}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <UserIcon className="h-3 w-3" />
                  <span>Given by: {asset.given_by}</span>
                </div>
                
                {asset.latitude && asset.longitude && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-600">
            {searchTerm || filterCustomer || filterAssetType
              ? "No assets match your current filters."
              : "Start by adding assets to your customers."}
          </p>
        </div>
      )}

      {showCamera && (
        <InAppCamera
          onPhotoTaken={handlePhotoTaken}
          onCancel={() => setShowCamera(false)}
        />
      )}
      </div>
    );
  } catch (error) {
    console.error('Assets component render error:', error);
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-red-600 mb-2">Component Error</h2>
          <p className="text-gray-600">
            There was an error loading the assets component. Please check the console for details.
          </p>
        </div>
      </div>
    );
  }
});

Assets.displayName = 'Assets';

export default Assets;