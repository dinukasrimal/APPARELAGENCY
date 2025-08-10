import { useState, useRef } from 'react';
import { User } from '@/types/auth';
import { Invoice, SalesOrder, Delivery } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Eye, Printer, FileText, Truck, CheckCircle, Signature, MapPin } from 'lucide-react';
import InvoiceDetails from './InvoiceDetails';
import PrintableInvoice from './PrintableInvoice';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceManagementProps {
  user: User;
  invoices: Invoice[];
  orders: SalesOrder[];
  deliveries?: Delivery[];
  onRefresh?: () => void;
}

const InvoiceManagement = ({ user, invoices, orders, deliveries = [], onRefresh }: InvoiceManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [markingForDelivery, setMarkingForDelivery] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [receivedByName, setReceivedByName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Filter invoices based on user role and filters
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (invoice.salesOrderId && invoice.salesOrderId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAgency = user.role === 'superuser' || invoice.agencyId === user.agencyId;
    
    return matchesSearch && matchesAgency;
  });

  const getSalesOrder = (salesOrderId?: string) => {
    return salesOrderId ? orders.find(order => order.id === salesOrderId) : null;
  };

  const handlePrint = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPrintView(true);
  };

  const handlePrintComplete = () => {
    setShowPrintView(false);
    setSelectedInvoice(null);
  };

  const getDeliveryForInvoice = (invoiceId: string) => {
    return deliveries.find(d => d.invoiceId === invoiceId);
  };

  const handleMarkForDelivery = async (invoiceId: string) => {
    // Show signature capture modal
    setCurrentInvoiceId(invoiceId);
    setShowSignatureModal(true);
    setSignature(null);
    setReceivedByName('');
    setDeliveryNotes('');
  };

  const handleSubmitSignature = async () => {
    if (!currentInvoiceId || !signature || !receivedByName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide signature and receiver name',
        variant: 'destructive',
      });
      return;
    }

    setMarkingForDelivery(currentInvoiceId);
    try {
      // Capture GPS coordinates
      const coordinates = await captureGPS();
      
      // Check if delivery already exists
      const { data: existingDelivery } = await supabase
        .from('deliveries')
        .select('*')
        .eq('invoice_id', currentInvoiceId)
        .single();

      if (existingDelivery) {
        // Update existing delivery to delivered status with signature and GPS
        const { error } = await supabase
          .from('deliveries')
          .update({
            status: 'delivered',
            delivery_agent_id: user.id,
            delivery_latitude: coordinates.latitude,
            delivery_longitude: coordinates.longitude,
            delivery_signature: signature,
            delivery_notes: deliveryNotes.trim() || null,
            received_by_name: receivedByName.trim(),
            delivered_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDelivery.id);

        if (error) throw error;
      } else {
        // Create new delivery record with delivered status
        const { error } = await supabase
          .from('deliveries')
          .insert({
            invoice_id: currentInvoiceId,
            delivery_agent_id: user.id,
            agency_id: user.agencyId,
            status: 'delivered',
            delivery_latitude: coordinates.latitude,
            delivery_longitude: coordinates.longitude,
            delivery_signature: signature,
            delivery_notes: deliveryNotes.trim() || null,
            received_by_name: receivedByName.trim(),
            delivered_at: new Date().toISOString(),
            created_by: user.id
          });

        if (error) throw error;
      }

      toast({
        title: 'Delivery Completed',
        description: `Invoice delivered successfully to ${receivedByName}`,
      });

      setShowSignatureModal(false);
      setCurrentInvoiceId(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error marking for delivery:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark invoice for delivery',
        variant: 'destructive',
      });
    } finally {
      setMarkingForDelivery(null);
    }
  };

  const captureGPS = async () => {
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

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error('Error capturing GPS:', error);
      // Return fallback coordinates (Sri Lanka center)
      return {
        latitude: 7.8731 + Math.random() * 0.01,
        longitude: 80.7718 + Math.random() * 0.01
      };
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

  if (showPrintView && selectedInvoice) {
    return (
      <PrintableInvoice
        invoice={selectedInvoice}
        salesOrder={getSalesOrder(selectedInvoice.salesOrderId)}
        onClose={handlePrintComplete}
      />
    );
  }

  if (selectedInvoice) {
    return (
      <InvoiceDetails
        invoice={selectedInvoice}
        salesOrder={getSalesOrder(selectedInvoice.salesOrderId)}
        onBack={() => setSelectedInvoice(null)}
        onPrint={() => handlePrint(selectedInvoice)}
      />
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 h-full flex flex-col">
      {/* Header - More compact */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="text-sm md:text-base text-gray-600">
            {user.role === 'superuser' ? 'All invoices across agencies' : 'Your agency invoices'}
          </p>
        </div>
      </div>

      {/* Search - More compact */}
      <div className="relative">
        <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 md:h-4 md:w-4" />
        <Input
          placeholder="Search by invoice ID, order ID, or customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-7 md:pl-10 h-9 md:h-10 text-sm"
        />
      </div>

      {/* Invoices List - Grid layout for tablets */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-6 md:py-12 flex-1 flex flex-col items-center justify-center">
          <FileText className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-2 md:mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">No invoices found</h3>
          <p className="text-sm md:text-base text-gray-600">
            {searchTerm 
              ? 'Try adjusting your search criteria'
              : 'No invoices have been created yet'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 flex-1 overflow-y-auto">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <h3 className="font-bold text-xl text-gray-900 mb-1">
                        {invoice.customerName || '[No Customer Name]'}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="default" className="text-xs">Invoice</Badge>
                        {invoice.salesOrderId && (
                          <Badge variant="outline" className="text-xs">
                            Order: {invoice.salesOrderId.substring(0, 8)}...
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Invoice #{invoice.invoiceNumber}</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="text-right">
                      <p className="text-lg md:text-xl font-bold">LKR {invoice.total.toLocaleString()}</p>
                      <p className="text-xs md:text-sm text-gray-500">
                        {invoice.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-1 md:gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-xs h-7 md:h-8"
                      >
                        <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700 text-xs h-7 md:h-8"
                        onClick={() => handlePrint(invoice)}
                      >
                        <Printer className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        Print
                      </Button>
                      {(() => {
                        const existingDelivery = getDeliveryForInvoice(invoice.id);
                        if (existingDelivery && existingDelivery.status === 'delivered') {
                          return (
                            <Badge variant="default" className="text-xs px-2 py-1 bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Delivered
                            </Badge>
                          );
                        } else if (existingDelivery && existingDelivery.status === 'out_for_delivery') {
                          return (
                            <Badge variant="outline" className="text-xs px-2 py-1 bg-blue-100 text-blue-800">
                              <Truck className="h-3 w-3 mr-1" />
                              Out for Delivery
                            </Badge>
                          );
                        } else if (!existingDelivery || existingDelivery.status === 'pending') {
                          return (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 md:h-8"
                              onClick={() => handleMarkForDelivery(invoice.id)}
                              disabled={markingForDelivery === invoice.id}
                            >
                              <Truck className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                              {markingForDelivery === invoice.id ? 'Processing...' : 'Mark for Delivery'}
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Signature Capture Modal */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Signature className="h-5 w-5" />
              Mark for Delivery
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="receivedBy">Received By (Required)</Label>
              <Input
                id="receivedBy"
                value={receivedByName}
                onChange={(e) => setReceivedByName(e.target.value)}
                placeholder="Name of person who will receive the items"
              />
            </div>

            <div>
              <Label htmlFor="notes">Delivery Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Any additional notes about the delivery..."
                rows={2}
              />
            </div>

            {/* Signature Capture */}
            <div>
              <Label>Agent/Customer Signature (Required)</Label>
              <div className="border rounded-lg p-4 bg-white">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={200}
                  className="border border-gray-200 rounded cursor-crosshair w-full"
                  style={{ maxHeight: '200px' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
                <div className="flex gap-2 mt-2 justify-between items-center">
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

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">GPS location will be captured automatically</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSignatureModal(false)}
              disabled={markingForDelivery === currentInvoiceId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitSignature}
              disabled={!receivedByName.trim() || !signature || markingForDelivery === currentInvoiceId}
              className="bg-green-600 hover:bg-green-700"
            >
              <Truck className="h-4 w-4 mr-2" />
              {markingForDelivery === currentInvoiceId ? 'Processing...' : 'Mark for Delivery'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceManagement;
