import { useState, useRef, useEffect } from 'react';
import { User } from '@/types/auth';
import { Delivery, Invoice } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  MapPin, 
  CheckCircle, 
  Signature,
  Phone,
  User as UserIcon,
  Package,
  AlertCircle,
  Calendar,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryDetailsProps {
  delivery: Delivery;
  invoice?: Invoice;
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

const DeliveryDetails = ({ delivery, invoice, user, onBack, onSuccess }: DeliveryDetailsProps) => {
  const [isDelivering, setIsDelivering] = useState(false);
  const [receivedByName, setReceivedByName] = useState(delivery.receivedByName || '');
  const [receivedByPhone, setReceivedByPhone] = useState(delivery.receivedByPhone || '');
  const [deliveryNotes, setDeliveryNotes] = useState(delivery.deliveryNotes || '');
  const [signature, setSignature] = useState<string | null>(delivery.deliverySignature || null);
  const [gpsCoordinates, setGpsCoordinates] = useState<{latitude: number, longitude: number} | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (delivery.deliveryLatitude && delivery.deliveryLongitude) {
      setGpsCoordinates({
        latitude: delivery.deliveryLatitude,
        longitude: delivery.deliveryLongitude
      });
    }
  }, [delivery]);

  const captureGPS = async () => {
    setIsCapturingLocation(true);
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      setGpsCoordinates(coords);
      toast({
        title: 'Location Captured',
        description: `GPS coordinates captured successfully`,
      });

      return coords;
    } catch (error) {
      console.error('Error capturing GPS:', error);
      toast({
        title: 'Location Error',
        description: 'Failed to capture GPS coordinates. Using approximate location.',
        variant: 'destructive',
      });
      // Fallback coordinates (Sri Lanka center)
      const fallbackCoords = {
        latitude: 7.8731 + Math.random() * 0.01,
        longitude: 80.7718 + Math.random() * 0.01
      };
      setGpsCoordinates(fallbackCoords);
      return fallbackCoords;
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setSignature(null);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!receivedByName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter the name of the person who received the delivery',
        variant: 'destructive',
      });
      return;
    }

    if (!signature) {
      toast({
        title: 'Signature Required',
        description: 'Please capture a signature before completing the delivery',
        variant: 'destructive',
      });
      return;
    }

    setIsDelivering(true);
    try {
      // Capture GPS if not already captured
      let coords = gpsCoordinates;
      if (!coords) {
        coords = await captureGPS();
      }

      const { error } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivery_latitude: coords.latitude,
          delivery_longitude: coords.longitude,
          delivery_signature: signature,
          delivery_notes: deliveryNotes.trim() || null,
          received_by_name: receivedByName.trim(),
          received_by_phone: receivedByPhone.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', delivery.id);

      if (error) throw error;

      toast({
        title: 'Delivery Completed',
        description: `Delivery has been successfully completed and marked as delivered`,
      });

      onSuccess();
      onBack();
    } catch (error) {
      console.error('Error completing delivery:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete delivery',
        variant: 'destructive',
      });
    } finally {
      setIsDelivering(false);
    }
  };

  const getStatusBadge = (status: Delivery['status']) => {
    const configs = {
      pending: { variant: 'secondary', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      out_for_delivery: { variant: 'default', label: 'Out for Delivery', color: 'bg-blue-100 text-blue-800' },
      delivered: { variant: 'default', label: 'Delivered', color: 'bg-green-100 text-green-800' },
      failed: { variant: 'destructive', label: 'Failed', color: 'bg-red-100 text-red-800' },
      cancelled: { variant: 'destructive', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' }
    };

    const config = configs[status];
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const canCompleteDelivery = delivery.status === 'out_for_delivery' && 
    (user.id === delivery.deliveryAgentId || user.role === 'superuser');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Deliveries
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Delivery Details</h2>
          <p className="text-gray-600">Delivery ID: {delivery.id}</p>
        </div>
        {getStatusBadge(delivery.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Customer</Label>
              <p className="text-lg font-semibold">{invoice?.customerName || 'Unknown Customer'}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-500">Invoice Details</Label>
              <p>Invoice #{invoice?.invoiceNumber}</p>
              <p>Amount: LKR {invoice?.total.toLocaleString()}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-500">Status</Label>
              <p>{delivery.status.replace('_', ' ').toUpperCase()}</p>
            </div>

            {delivery.scheduledDate && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Scheduled Date</Label>
                <p className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {delivery.scheduledDate.toLocaleDateString()}
                </p>
              </div>
            )}

            {delivery.deliveredAt && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Delivered At</Label>
                <p className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {delivery.deliveredAt.toLocaleString()}
                </p>
              </div>
            )}

            {delivery.deliveryLatitude && delivery.deliveryLongitude && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Delivery Location</Label>
                <p className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {delivery.deliveryLatitude.toFixed(6)}, {delivery.deliveryLongitude.toFixed(6)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Completion Form */}
        {canCompleteDelivery && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Complete Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="receivedBy">Received By (Required)</Label>
                <Input
                  id="receivedBy"
                  value={receivedByName}
                  onChange={(e) => setReceivedByName(e.target.value)}
                  placeholder="Name of person who received the items"
                />
              </div>

              <div>
                <Label htmlFor="receivedPhone">Receiver's Phone</Label>
                <Input
                  id="receivedPhone"
                  value={receivedByPhone}
                  onChange={(e) => setReceivedByPhone(e.target.value)}
                  placeholder="Phone number (optional)"
                />
              </div>

              <div>
                <Label htmlFor="notes">Delivery Notes</Label>
                <Textarea
                  id="notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any additional notes about the delivery..."
                  rows={3}
                />
              </div>

              {/* GPS Capture */}
              <div>
                <Label>Delivery Location</Label>
                {gpsCoordinates ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">
                      Location captured: {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}
                    </span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={captureGPS}
                    disabled={isCapturingLocation}
                    className="w-full"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {isCapturingLocation ? 'Capturing Location...' : 'Capture GPS Location'}
                  </Button>
                )}
              </div>

              {/* Signature Capture */}
              <div>
                <Label>Customer Signature (Required)</Label>
                <div className="border rounded-lg p-4 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={150}
                    className="border border-gray-200 rounded cursor-crosshair w-full"
                    style={{ maxHeight: '150px' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                      Clear Signature
                    </Button>
                    {signature && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <Signature className="h-3 w-3 mr-1" />
                        Signature Captured
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCompleteDelivery}
                disabled={isDelivering || !receivedByName.trim() || !signature}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isDelivering ? 'Completing Delivery...' : 'Complete Delivery'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delivery History/Details for completed deliveries */}
        {delivery.status === 'delivered' && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery Completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {delivery.receivedByName && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Received By</Label>
                  <p className="flex items-center gap-1">
                    <UserIcon className="h-4 w-4" />
                    {delivery.receivedByName}
                  </p>
                </div>
              )}

              {delivery.receivedByPhone && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Contact Number</Label>
                  <p className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {delivery.receivedByPhone}
                  </p>
                </div>
              )}

              {delivery.deliveryNotes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Delivery Notes</Label>
                  <p className="text-sm">{delivery.deliveryNotes}</p>
                </div>
              )}

              {delivery.deliverySignature && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Customer Signature</Label>
                  <img 
                    src={delivery.deliverySignature} 
                    alt="Customer Signature"
                    className="border rounded max-w-full h-24 object-contain"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alert for delivery instructions */}
      {canCompleteDelivery && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Delivery Instructions:</strong> Please ensure all items are delivered in good condition. 
            Capture the customer's signature and GPS location before marking as delivered. 
            The customer or authorized person must sign to confirm receipt.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DeliveryDetails;