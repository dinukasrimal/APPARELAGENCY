import { useState, useEffect } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import InAppCamera from '@/components/camera/InAppCamera';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  agency_id: string;
  latitude?: number;
  longitude?: number;
}

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

const Assets = ({ user }: AssetsProps) => {
  console.log('Assets component mounting with user:', user);
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
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
  const { toast } = useToast();

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
    fetchCustomers();
    fetchAssets();
  }, []);

  const fetchCustomers = async () => {
    try {
      console.log('Assets: Fetching customers for user:', user);
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, address, phone, agency_id, latitude, longitude')
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
      setCustomers(data || []);
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

  const handlePhotoTaken = (photoData: string) => {
    setPhoto(photoData);
    setShowCamera(false);
    getCurrentLocation();
  };

  const handleAddAsset = async () => {
    if (!selectedCustomer || !assetType || !description || !photo) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and take a photo.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('customer_assets')
        .insert([
          {
            customer_id: selectedCustomer,
            asset_type: assetType,
            description: description,
            photo_url: photo,
            latitude: latitude,
            longitude: longitude,
            given_by: user.name,
          }
        ])
        .select(`
          *,
          customer:customers(id, name, address, phone)
        `);

      if (error) {
        console.error('Error adding asset:', error);
        toast({
          title: "Error",
          description: "Failed to add asset",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Asset Added",
        description: "Asset has been successfully added to the customer.",
      });

      setAssets(prev => [...(data || []), ...prev]);
      
      setSelectedCustomer('');
      setAssetType('');
      setDescription('');
      setPhoto('');
      setLatitude(null);
      setLongitude(null);
      setDialogOpen(false);
    } catch (error) {
      console.error('Error adding asset:', error);
      toast({
        title: "Error",
        description: "Failed to add asset",
        variant: "destructive",
      });
    } finally {
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
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    </div>
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
                  onClick={handleAddAsset} 
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Adding...' : 'Add Asset'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
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
        <Dialog open={showCamera} onOpenChange={setShowCamera}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Take Asset Photo</DialogTitle>
            </DialogHeader>
            <InAppCamera
              onPhotoTaken={handlePhotoTaken}
              onCancel={() => setShowCamera(false)}
            />
          </DialogContent>
        </Dialog>
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
};

export default Assets;