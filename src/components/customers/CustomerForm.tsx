import { useState, useRef } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Camera, MapPin, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SignatureCapture from '@/components/sales/SignatureCapture';
import InAppCamera from '@/components/camera/InAppCamera';
import { uploadCustomerPhoto, base64ToBlob } from '@/utils/storage';

interface CustomerFormProps {
  user: User;
  customer?: Customer | null;
  onSubmit: (customer: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const CustomerForm = ({ user, customer, onSubmit, onCancel }: CustomerFormProps) => {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    agencyId: customer?.agencyId || user.agencyId || '00000000-0000-0000-0000-000000000000',
    shopOwnerName: customer?.shopOwnerName || '',
    shopOwnerBirthday: customer?.shopOwnerBirthday || ''
  });

  const [gpsCoordinates, setGpsCoordinates] = useState(
    customer?.gpsCoordinates || { latitude: 0, longitude: 0 }
  );

  const [capturedPhoto, setCapturedPhoto] = useState<string>(customer?.storefrontPhoto || '');
  const [capturedPhotoFile, setCapturedPhotoFile] = useState<Blob | null>(null);
  const [showInAppCamera, setShowInAppCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [signature, setSignature] = useState<string>(customer?.signature || '');
  const [phoneError, setPhoneError] = useState('');
  const { toast } = useToast();

  const validatePhone = (phone: string) => {
    // Remove any non-numeric characters
    const numericPhone = phone.replace(/\D/g, '');
    
    if (numericPhone.length === 0) {
      setPhoneError('');
      return true;
    }
    
    if (numericPhone.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return false;
    }
    
    setPhoneError('');
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Only allow numeric characters
    const numericOnly = input.replace(/\D/g, '');
    
    // Limit to 10 digits
    if (numericOnly.length <= 10) {
      setFormData({ ...formData, phone: numericOnly });
      validatePhone(numericOnly);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    if (!validatePhone(formData.phone)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    if (!formData.address.trim()) {
      toast({
        title: "Validation Error",
        description: "Address is required",
        variant: "destructive",
      });
      return;
    }

    if (!capturedPhoto) {
      toast({
        title: "Validation Error",
        description: "Please capture a storefront photo",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('Submitting customer form:', { formData, gpsCoordinates });
      
      let storefrontPhotoUrl = capturedPhoto;
      
      // Upload photo to storage if it's a base64 image
      if (capturedPhoto && capturedPhoto.startsWith('data:image/')) {
        console.log('Detected base64 photo, starting upload...');
        setIsUploadingPhoto(true);
        
        let photoFile = capturedPhotoFile;
        if (!photoFile) {
          console.log('Converting base64 to blob...');
          // Convert base64 to blob if we don't have the file object
          photoFile = base64ToBlob(capturedPhoto, 'image/jpeg');
          console.log('Blob created:', photoFile.size, 'bytes');
        }
        
        console.log('Calling uploadCustomerPhoto...');
        const uploadResult = await uploadCustomerPhoto(photoFile);
        console.log('Upload result:', uploadResult);
        
        if (uploadResult.success && uploadResult.url) {
          storefrontPhotoUrl = uploadResult.url;
          console.log('Photo uploaded successfully:', uploadResult.url);
          toast({
            title: "Success",
            description: "Photo uploaded to storage successfully!",
          });
        } else {
          console.error('Photo upload failed:', uploadResult.error);
          toast({
            title: "Storage Upload Error",
            description: `Upload failed: ${uploadResult.error || 'Unknown error'}. Check if customer-photos bucket exists.`,
            variant: "destructive",
          });
          // Don't return here - let it save with base64 as fallback
          console.log('Continuing with base64 photo as fallback');
        }
        setIsUploadingPhoto(false);
      } else {
        console.log('Photo is not base64 or already a URL:', capturedPhoto?.substring(0, 50));
      }
      
      await onSubmit({
        ...formData,
        gpsCoordinates,
        storefrontPhoto: storefrontPhotoUrl,
        signature: signature || 'placeholder-signature.png'
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Failed to save customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          console.log('GPS coordinates captured:', newCoordinates);
          setGpsCoordinates(newCoordinates);
        },
        (error) => {
          console.error('GPS Error:', error);
          // Fallback to demo coordinates for testing
          const fallbackCoordinates = {
            latitude: 28.6139 + Math.random() * 0.01,
            longitude: 77.2090 + Math.random() * 0.01
          };
          console.log('Using fallback coordinates:', fallbackCoordinates);
          setGpsCoordinates(fallbackCoordinates);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    } else {
      // Fallback for browsers without geolocation
      const fallbackCoordinates = {
        latitude: 28.6139 + Math.random() * 0.01,
        longitude: 77.2090 + Math.random() * 0.01
      };
      console.log('Geolocation not supported, using fallback:', fallbackCoordinates);
      setGpsCoordinates(fallbackCoordinates);
    }
  };

  const handlePhotoCapture = (photoData: string) => {
    setCapturedPhoto(photoData);
    
    // Convert base64 to blob for uploading
    const blob = base64ToBlob(photoData, 'image/jpeg');
    setCapturedPhotoFile(blob);
    
    getCurrentLocation(); // Capture location when photo is taken
    
    // Close camera after photo is captured
    setShowInAppCamera(false);
    
    toast({
      title: "Success",
      description: "Photo and location captured successfully!",
    });
  };

  const openCamera = () => {
    setShowInAppCamera(true);
  };

  const handleSignatureCapture = (signatureData: string) => {
    setSignature(signatureData);
    setShowSignatureCapture(false);
    toast({
      title: "Success",
      description: "Customer signature captured successfully!",
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {customer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            {customer ? 'Update customer information' : 'Onboard a new customer to your agency'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter customer/store name"
                  required
                  className="text-base"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="1234567890"
                  required
                  className={`text-base ${phoneError ? 'border-red-500' : ''}`}
                  maxLength={10}
                />
                {phoneError && (
                  <p className="text-red-500 text-sm mt-1">{phoneError}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Enter 10-digit phone number (numbers only)</p>
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter complete address"
                  required
                  rows={3}
                  className="text-base resize-none"
                />
              </div>

              <div>
                <Label htmlFor="shopOwnerName">Shop Owner Name</Label>
                <Input
                  id="shopOwnerName"
                  value={formData.shopOwnerName}
                  onChange={(e) => setFormData({ ...formData, shopOwnerName: e.target.value })}
                  placeholder="Enter shop owner's name"
                  className="text-base"
                />
              </div>

              <div>
                <Label htmlFor="shopOwnerBirthday">Shop Owner Birthday</Label>
                <Input
                  id="shopOwnerBirthday"
                  type="date"
                  value={formData.shopOwnerBirthday}
                  onChange={(e) => setFormData({ ...formData, shopOwnerBirthday: e.target.value })}
                  className="text-base"
                />
                <p className="text-gray-500 text-xs mt-1">Optional: Used for birthday promotions and greetings</p>
              </div>
            </CardContent>
          </Card>

          {/* Documentation & Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Documentation & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Storefront Photo */}
              <div>
                <Label>Storefront Photo *</Label>
                {capturedPhoto ? (
                  <div className="space-y-2">
                    <img 
                      src={capturedPhoto} 
                      alt="Storefront" 
                      className="w-full h-32 sm:h-40 object-cover rounded border"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCapturedPhoto('')}
                        size="sm"
                        className="flex-1 sm:flex-none"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openCamera}
                        size="sm"
                        className="flex-1 sm:flex-none"
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
                    className="w-full h-12 text-base"
                    onClick={openCamera}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Storefront Photo
                  </Button>
                )}
              </div>

              {/* GPS Display */}
              {(gpsCoordinates.latitude !== 0 || gpsCoordinates.longitude !== 0) && (
                <div className="text-sm text-gray-600 p-3 bg-green-50 rounded">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="break-all">Location: {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}</span>
                  </div>
                </div>
              )}

              {/* Customer Signature */}
              <div>
                <Label>Customer Signature</Label>
                {signature ? (
                  <div className="space-y-2">
                    <img 
                      src={signature} 
                      alt="Customer Signature" 
                      className="w-full h-16 sm:h-20 object-contain border rounded bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSignatureCapture(true)}
                      className="w-full h-12 text-base"
                    >
                      Retake Signature
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base"
                    onClick={() => setShowSignatureCapture(true)}
                  >
                    Capture Customer Signature
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            disabled={isSubmitting}
            className="w-full sm:w-auto h-12 text-base"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="w-full sm:w-auto h-12 text-base bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting || isUploadingPhoto || !formData.name || !formData.phone || !formData.address || !capturedPhoto || !!phoneError}
          >
            {isUploadingPhoto ? 'Uploading Photo...' : (isSubmitting ? 'Saving...' : (customer ? 'Update Customer' : 'Add Customer'))}
          </Button>
        </div>
      </form>

      {/* In-App Camera */}
      {showInAppCamera && (
        <InAppCamera
          onPhotoTaken={handlePhotoCapture}
          onCancel={() => setShowInAppCamera(false)}
        />
      )}

      {/* Signature Capture Modal */}
      {showSignatureCapture && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <SignatureCapture
              customerName={formData.name || 'Customer'}
              onSignatureCapture={handleSignatureCapture}
            />
            <div className="p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowSignatureCapture(false)}
                className="w-full h-12 text-base"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerForm;
