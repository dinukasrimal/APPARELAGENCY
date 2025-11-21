import { useState } from 'react';
import { User } from '@/types/auth';
import { Invoice, ReturnItem } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Minus, Plus, User as UserIcon } from 'lucide-react';

interface CreateReturnFormProps {
  user: User;
  invoices: Invoice[];
  customers: Customer[];
  onSubmit: (returnData: any) => void;
  onCancel: () => void;
}

const CreateReturnForm = ({ user, invoices, customers, onSubmit, onCancel }: CreateReturnFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState('');

  // Filter customers based on user role and search
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                         customer.phone.toLowerCase().includes(customerSearchTerm.toLowerCase());
    const matchesAgency = user.role === 'superuser' || customer.agencyId === user.agencyId;
    
    return matchesSearch && matchesAgency;
  });

  // Filter invoices for selected customer
  const customerInvoices = invoices.filter(invoice => 
    invoice.customerId === selectedCustomerId &&
    invoice.id.toLowerCase().includes(invoiceSearchTerm.toLowerCase())
  );

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);
  const selectedInvoice = invoices.find(invoice => invoice.id === selectedInvoiceId);

  const updateReturnItem = (invoiceItemId: string, field: string, value: any) => {
    setReturnItems(prev => {
      const existing = prev.find(item => item.invoiceItemId === invoiceItemId);
      const invoiceItem = selectedInvoice?.items.find(item => item.id === invoiceItemId);
      
      if (!invoiceItem) return prev;

      if (!existing) {
        if (field === 'quantityReturned' && value > 0) {
          const newItem: ReturnItem = {
            id: `return-${Date.now()}-${invoiceItemId}`,
            invoiceItemId,
            productId: invoiceItem.productId,
            productName: invoiceItem.productName,
            color: invoiceItem.color,
            size: invoiceItem.size,
            quantityReturned: value,
            originalQuantity: invoiceItem.quantity,
            unitPrice: invoiceItem.unitPrice,
            total: invoiceItem.unitPrice * value,
            reason: ''
          };
          return [...prev, newItem];
        }
        return prev;
      } else {
        if (field === 'quantityReturned' && value === 0) {
          return prev.filter(item => item.invoiceItemId !== invoiceItemId);
        }
        return prev.map(item => 
          item.invoiceItemId === invoiceItemId 
            ? { 
                ...item, 
                [field]: value,
                total: field === 'quantityReturned' ? item.unitPrice * value : item.total
              }
            : item
        );
      }
    });
  };

  const getReturnQuantity = (invoiceItemId: string) => {
    const returnItem = returnItems.find(item => item.invoiceItemId === invoiceItemId);
    return returnItem?.quantityReturned || 0;
  };

  const getReturnReason = (invoiceItemId: string) => {
    const returnItem = returnItems.find(item => item.invoiceItemId === invoiceItemId);
    return returnItem?.reason || '';
  };

  const totalReturnAmount = returnItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (!selectedInvoice || returnItems.length === 0 || !reason) {
      return;
    }

    try {
      // Get current location with better error handling
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          }
        );
      });

      const returnData = {
        invoiceId: selectedInvoice.id,
        customerId: selectedInvoice.customerId,
        customerName: selectedInvoice.customerName,
        agencyId: selectedInvoice.agencyId,
        items: returnItems,
        subtotal: totalReturnAmount,
        total: totalReturnAmount,
        reason,
        // Auto-approve customer returns (no manual approval step)
        status: 'approved' as const,
        gpsCoordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      };

      console.log('Submitting return data:', returnData);
      await onSubmit(returnData);
    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback coordinates if location access is denied
      const returnData = {
        invoiceId: selectedInvoice.id,
        customerId: selectedInvoice.customerId,
        customerName: selectedInvoice.customerName,
        agencyId: selectedInvoice.agencyId,
        items: returnItems,
        subtotal: totalReturnAmount,
        total: totalReturnAmount,
        reason,
        // Auto-approve customer returns (no manual approval step)
        status: 'approved' as const,
        gpsCoordinates: {
          latitude: 7.8731 + Math.random() * 0.01,
          longitude: 80.7718 + Math.random() * 0.01
        }
      };
      
      console.log('Submitting return data with fallback location:', returnData);
      await onSubmit(returnData);
    }
  };

  const resetSelection = () => {
    setSelectedCustomerId('');
    setSelectedInvoiceId('');
    setReturnItems([]);
    setReason('');
    setInvoiceSearchTerm('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Returns
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Process Return</h2>
          <p className="text-gray-600">Select a customer and then their invoice to process return</p>
        </div>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Step 1: Select Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers by name or phone..."
              value={customerSearchTerm}
              onChange={(e) => setCustomerSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCustomerId} onValueChange={(value) => {
            setSelectedCustomerId(value);
            setSelectedInvoiceId('');
            setReturnItems([]);
            setReason('');
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {filteredCustomers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCustomer && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">Selected Customer:</h4>
              <p className="text-blue-800">{selectedCustomer.name}</p>
              <p className="text-sm text-blue-700">{selectedCustomer.phone} • {selectedCustomer.address}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Selection - Only show if customer is selected */}
      {selectedCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search invoices by ID..."
                value={invoiceSearchTerm}
                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {customerInvoices.length > 0 ? (
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an invoice to process return" />
                </SelectTrigger>
                <SelectContent>
                  {customerInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.id} - LKR {invoice.total.toLocaleString()} ({invoice.createdAt.toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-center py-6 text-gray-500">
                No invoices found for this customer
              </div>
            )}

            {selectedCustomerId && (
              <Button variant="outline" onClick={resetSelection} size="sm">
                Reset Selection
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Invoice Details - Only show if invoice is selected */}
      {selectedInvoice && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Invoice Details & Return Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="font-medium text-sm text-gray-700">Invoice ID:</span>
                <p className="text-sm">{selectedInvoice.id}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Customer:</span>
                <p className="text-sm">{selectedInvoice.customerName}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Total Amount:</span>
                <p className="text-sm">LKR {selectedInvoice.total.toLocaleString()}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Date:</span>
                <p className="text-sm">{selectedInvoice.createdAt.toLocaleDateString()}</p>
              </div>
            </div>

            {/* Invoice Items for Return */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700">Select Items to Return:</h4>
              {selectedInvoice.items.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">
                        {item.color}, {item.size} - LKR {item.unitPrice} each
                      </p>
                      <p className="text-sm text-gray-600">
                        Original Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">LKR {item.total.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Return Quantity:</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const currentQty = getReturnQuantity(item.id);
                            if (currentQty > 0) {
                              updateReturnItem(item.id, 'quantityReturned', currentQty - 1);
                            }
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={getReturnQuantity(item.id)}
                          onChange={(e) => {
                            const value = Math.min(parseInt(e.target.value) || 0, item.quantity);
                            updateReturnItem(item.id, 'quantityReturned', value);
                          }}
                          className="w-20 text-center"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const currentQty = getReturnQuantity(item.id);
                            if (currentQty < item.quantity) {
                              updateReturnItem(item.id, 'quantityReturned', currentQty + 1);
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {getReturnQuantity(item.id) > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Return Reason:</label>
                        <Input
                          value={getReturnReason(item.id)}
                          onChange={(e) => updateReturnItem(item.id, 'reason', e.target.value)}
                          placeholder="Reason for return"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  {getReturnQuantity(item.id) > 0 && (
                    <div className="bg-red-50 p-2 rounded text-sm">
                      <span className="font-medium">Return Value: </span>
                      <span className="text-red-600 font-medium">
                        LKR {(item.unitPrice * getReturnQuantity(item.id)).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return Summary */}
      {returnItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Return Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Overall Return Reason:</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide an overall reason for this return..."
                className="mt-1"
              />
            </div>

            <div className="space-y-2 p-3 bg-red-50 rounded">
              <div className="flex justify-between">
                <span className="font-medium">Items to Return:</span>
                <span>{returnItems.length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-red-600">
                <span>Total Return Amount:</span>
                <span>LKR {totalReturnAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={returnItems.length === 0 || !reason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                Process Return
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateReturnForm;
