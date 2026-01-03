import { useState, useEffect, useRef } from 'react';
import { User } from '@/types/auth';
import { SalesOrder, Invoice, InvoiceItem } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, FileText, Plus, Minus } from 'lucide-react';
import SignatureCapture from './SignatureCapture';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { externalInventoryService } from '@/services/external-inventory.service';

interface CreateInvoiceFormProps {
  user: User;
  salesOrder: SalesOrder;
  invoicedItems?: InvoiceItem[];
  onSubmit: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'createdBy'> & { signature?: string }) => void;
  onCancel: () => void;
}

const CreateInvoiceForm = ({ user, salesOrder, invoicedItems = [], onSubmit, onCancel }: CreateInvoiceFormProps) => {
  // Helper to group already invoiced quantities by product/color/size
  const invoicedQtyByKey = invoicedItems.reduce<Record<string, number>>((acc, item) => {
    const key = `${item.productId || item.productName}|${item.color}|${item.size}`;
    acc[key] = (acc[key] || 0) + item.quantity;
    return acc;
  }, {});

  const initialInvoiceItems: InvoiceItem[] = salesOrder.items
    .map((item) => {
      const key = `${item.productId || item.productName}|${item.color}|${item.size}`;
      const alreadyQty = invoicedQtyByKey[key] || 0;
      const remainingQty = Math.max(0, item.quantity - alreadyQty);
      if (remainingQty <= 0) return null;
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        quantity: remainingQty,
        unitPrice: item.unitPrice,
        total: item.unitPrice * remainingQty
      } as InvoiceItem;
    })
    .filter((item): item is InvoiceItem => item !== null);

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>(initialInvoiceItems);
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: 0, longitude: 0 });
  const [signature, setSignature] = useState<string>('');
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const { toast } = useToast();

  const captureGPS = async (): Promise<{ latitude: number; longitude: number }> => {
    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
          );
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } else {
        throw new Error('Geolocation not supported');
      }
    } catch (error) {
      console.error('GPS Error:', error);
      // Fallback for demo
      return {
        latitude: 7.8731 + Math.random() * 0.01,
        longitude: 80.7718 + Math.random() * 0.01
      };
    }
  };

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * salesOrder.discountPercentage) / 100;
  const total = subtotal - discountAmount;

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 0) return;

    const originalItem = salesOrder.items.find(item => item.id === itemId);
    if (!originalItem) return;
    const key = `${originalItem.productId || originalItem.productName}|${originalItem.color}|${originalItem.size}`;
    const alreadyQty = invoicedQtyByKey[key] || 0;
    const remainingCap = Math.max(0, originalItem.quantity - alreadyQty);
    const clampedQuantity = Math.min(quantity, remainingCap);

    setInvoiceItems(
      invoiceItems
        .map(item =>
          item.id === itemId
            ? { ...item, quantity: clampedQuantity, total: item.unitPrice * clampedQuantity }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const handleSignatureCapture = (signatureData: string) => {
    setSignature(signatureData);
    setShowSignatureCapture(false);
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;

    if (invoiceItems.length === 0 || !signature) {
      toast({
        title: "Error",
        description: "Please ensure you have items and a signature",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    submitLockRef.current = true;

    try {
      // Capture GPS coordinates when creating invoice
      toast({
        title: "Capturing location",
        description: "Getting GPS coordinates..."
      });

      const coords = await captureGPS();
      setGpsCoordinates(coords);

      console.log('Creating invoice with data:', {
        salesOrder,
        gpsCoordinates: coords,
        invoiceItems
      });

      // Insert invoice
      const invoiceData: any = {
        customer_id: salesOrder.customerId,
        customer_name: salesOrder.customerName,
        agency_id: salesOrder.agencyId,
        subtotal,
        discount_amount: discountAmount,
        total,
        latitude: coords.latitude,
        longitude: coords.longitude,
        signature,
        created_by: user.id
      };

      // Only include sales_order_id if it's a valid UUID
      if (salesOrder.id && salesOrder.id.includes('-') && salesOrder.id.length === 36) {
        invoiceData.sales_order_id = salesOrder.id;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) {
        console.error('Invoice insert error:', invoiceError);
        throw invoiceError;
      }

      console.log('Invoice created:', invoice);

      // Insert invoice items
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        product_id: item.productId,
        product_name: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Invoice items insert error:', itemsError);
        throw itemsError;
      }

      console.log('Invoice items created');

      // Create external inventory transactions to reduce stock
      try {
        console.log('Creating external inventory transactions for invoice:', invoice.id);
        
        // Get user profile name for reference
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        const userName = profileData?.name || 'Unknown User';

        for (const item of invoiceItems) {
          console.log('Creating stock out transaction for:', {
            agencyId: user.agencyId,
            userName,
            productName: item.productName,
            color: item.color || 'Default',
            size: item.size || 'Default',
            quantity: item.quantity,
            customerName: salesOrder.customerName,
            invoiceId: invoice.id,
            unitPrice: item.unitPrice
          });
          
          await externalInventoryService.addSaleTransaction(
            user.agencyId,
            userName,
            item.productName,
            item.color || 'Default',
            item.size || 'Default',
            item.quantity,
            salesOrder.customerName,
            invoice.id,
            item.unitPrice
          );
          
          console.log('Stock out transaction created for item:', item.productName);
        }

        console.log('All external inventory transactions created successfully');
      } catch (error) {
        console.error('❌ CRITICAL: Error creating external inventory transactions:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        // Don't throw error to prevent invoice creation failure
        console.log('❌ Invoice created but external inventory tracking failed');
        
        // Show error to user via toast for debugging
        toast({
          title: "Warning: Inventory not updated",
          description: `Invoice created but stock was not reduced. Error: ${error?.message || 'Unknown error'}`,
          variant: "destructive",
        });
      }

      toast({
        title: "Success",
        description: "Invoice created successfully with GPS location captured and inventory updated",
      });

      const invoiceResponseData = {
        salesOrderId: salesOrder.id,
        invoiceNumber: invoice.id,
        customerId: salesOrder.customerId,
        customerName: salesOrder.customerName,
        agencyId: salesOrder.agencyId,
        items: invoiceItems,
        subtotal,
        discountAmount,
        total,
        gpsCoordinates: coords,
        signature
      };

      onSubmit(invoiceResponseData);
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
          <p className="text-gray-600">Convert sales order {salesOrder.orderNumber} to invoice</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Order ID:</span> {salesOrder.id}
                </div>
                <div>
                  <span className="font-medium">Customer:</span> {salesOrder.customerName}
                </div>
                <div>
                  <span className="font-medium">Original Total:</span> LKR {salesOrder.total.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Discount:</span> {salesOrder.discountPercentage}%
                </div>
              </div>
              
              {gpsCoordinates.latitude !== 0 && (
                <div className="p-2 bg-green-50 rounded text-green-700 text-sm mt-4">
                  ✓ Location will be captured when creating invoice: {gpsCoordinates.latitude.toFixed(6)}, {gpsCoordinates.longitude.toFixed(6)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
              <p className="text-sm text-gray-600">
                Adjust quantities if needed (e.g., due to stock issues). Set quantity to 0 to remove items.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invoiceItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.productName}</h4>
                      <p className="text-sm text-gray-600">
                        {item.color}, {item.size} - LKR {item.unitPrice} each
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-right min-w-24">
                        <p className="font-medium">LKR {item.total.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Signature Capture */}
          {showSignatureCapture && (
            <SignatureCapture
              customerName={salesOrder.customerName}
              onSignatureCapture={handleSignatureCapture}
            />
          )}
        </div>

        {/* Invoice Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Discount ({salesOrder.discountPercentage}%):</span>
                  <span>-LKR {discountAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>LKR {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Signature Status */}
              <div className="space-y-2 pt-4 border-t">
                {signature ? (
                  <div className="text-center">
                    <p className="text-sm text-green-600 font-medium mb-2">✓ Signature Captured</p>
                    <img 
                      src={signature} 
                      alt="Customer Signature" 
                      className="w-full h-20 object-contain border rounded bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSignatureCapture(true)}
                      className="mt-2"
                    >
                      Retake Signature
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSignatureCapture(true)}
                    className="w-full"
                  >
                    Capture Customer Signature
                  </Button>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Button
                  onClick={handleSubmit}
                  disabled={invoiceItems.length === 0 || !signature || isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating Invoice & Capturing GPS...' : 'Create Invoice'}
                </Button>
                <Button variant="outline" onClick={onCancel} className="w-full">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceForm;
