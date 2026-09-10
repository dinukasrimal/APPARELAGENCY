import { useRef, useState } from 'react';
import { User } from '@/types/auth';
import { Invoice, Return, ReturnItem } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Receipt, Search, User as UserIcon } from 'lucide-react';

interface CreateReturnFormProps {
  user: User;
  customers: Customer[];
  invoices: Invoice[];
  returns: Return[];
  onSubmit: (returnData: any) => void;
  onCancel: () => void;
}

const CreateReturnForm = ({ user, customers, invoices, returns, onSubmit, onCancel }: CreateReturnFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  // Quantity being returned per invoice line, keyed by invoice_item id
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // Filter customers based on user role and search
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                         customer.phone.toLowerCase().includes(customerSearchTerm.toLowerCase());
    const matchesAgency = user.role === 'superuser' || customer.agencyId === user.agencyId;

    return matchesSearch && matchesAgency;
  });

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);

  // Invoices belonging to the chosen customer, newest first
  const customerInvoices = invoices
    .filter(invoice => invoice.customerId === selectedCustomerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const selectedInvoice = customerInvoices.find(invoice => invoice.id === selectedInvoiceId);

  // How much of each invoice line has already been returned, so a line can
  // never be returned twice. Rejected returns don't count against the invoice.
  const alreadyReturnedByItemId = returns.reduce<Record<string, number>>((acc, ret) => {
    if (ret.status === 'rejected') return acc;
    ret.items.forEach(item => {
      if (item.invoiceItemId) {
        acc[item.invoiceItemId] = (acc[item.invoiceItemId] || 0) + Number(item.quantityReturned || 0);
      }
    });
    return acc;
  }, {});

  const availableToReturn = (invoiceItemId: string, invoicedQuantity: number) =>
    Math.max(0, invoicedQuantity - (alreadyReturnedByItemId[invoiceItemId] || 0));

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedInvoiceId('');
    setQuantities({});
    setItemReasons({});
    setReason('');
  };

  const handleInvoiceChange = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setQuantities({});
    setItemReasons({});
  };

  const updateQuantity = (invoiceItemId: string, invoicedQuantity: number, value: number) => {
    const capped = Math.max(0, Math.min(value || 0, availableToReturn(invoiceItemId, invoicedQuantity)));
    setQuantities(prev => ({ ...prev, [invoiceItemId]: capped }));
  };

  // Return lines are built from the invoice's own lines, so each carries the
  // invoice_item_id and the price actually invoiced.
  const returnItems: ReturnItem[] = (selectedInvoice?.items || [])
    .filter(item => (quantities[item.id] || 0) > 0)
    .map(item => {
      const quantityReturned = quantities[item.id];
      return {
        id: item.id,
        invoiceItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        quantityReturned,
        originalQuantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.unitPrice * quantityReturned,
        reason: itemReasons[item.id] || ''
      };
    });

  const subtotalReturnAmount = returnItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = discountType === 'percentage'
    ? (subtotalReturnAmount * discountValue) / 100
    : discountValue;
  const totalReturnAmount = Math.max(0, subtotalReturnAmount - discountAmount);

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedInvoice || !reason || returnItems.length === 0) {
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    const buildReturnData = (latitude: number, longitude: number) => ({
      invoiceId: selectedInvoice.id,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      agencyId: selectedCustomer.agencyId,
      items: returnItems,
      subtotal: subtotalReturnAmount,
      total: totalReturnAmount,
      discountType,
      discountValue,
      discountAmount,
      reason,
      status: 'approved' as const,
      gpsCoordinates: { latitude, longitude }
    });

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

      await onSubmit(buildReturnData(position.coords.latitude, position.coords.longitude));
    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback coordinates if location access is denied
      await onSubmit(buildReturnData(
        7.8731 + Math.random() * 0.01,
        80.7718 + Math.random() * 0.01
      ));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
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
          <p className="text-gray-600">Select the customer and the invoice being returned against</p>
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

          <Select value={selectedCustomerId} onValueChange={handleCustomerChange}>
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

      {/* Invoice Selection */}
      {selectedCustomer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Step 2: Select Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customerInvoices.length === 0 ? (
              <p className="text-sm text-gray-600">
                No invoices found for this customer, so there is nothing to return against.
              </p>
            ) : (
              <>
                <Select value={selectedInvoiceId} onValueChange={handleInvoiceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the invoice being returned against" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} • {invoice.createdAt.toLocaleDateString()} • LKR {invoice.total.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedInvoice && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-green-900">{selectedInvoice.invoiceNumber}</span>
                      <span className="text-green-800">{selectedInvoice.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between mt-1 text-green-800">
                      <span>Invoice total:</span>
                      <span>LKR {selectedInvoice.total.toLocaleString()}</span>
                    </div>
                    {selectedInvoice.outstandingAmount !== undefined && (
                      <div className="flex justify-between text-green-800">
                        <span>Outstanding:</span>
                        <span>LKR {selectedInvoice.outstandingAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Return Items Entry — driven by the invoice's own lines */}
      {selectedInvoice && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Select Items to Return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 p-3 text-left">Product</th>
                    <th className="border border-gray-200 p-3 text-left">Colour / Size</th>
                    <th className="border border-gray-200 p-3 text-right">Unit Price</th>
                    <th className="border border-gray-200 p-3 text-right">Invoiced</th>
                    <th className="border border-gray-200 p-3 text-right">Returned</th>
                    <th className="border border-gray-200 p-3 text-right">Available</th>
                    <th className="border border-gray-200 p-3 text-right">Qty to Return</th>
                    <th className="border border-gray-200 p-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((item) => {
                    const alreadyReturned = alreadyReturnedByItemId[item.id] || 0;
                    const available = availableToReturn(item.id, item.quantity);
                    const quantity = quantities[item.id] || 0;
                    return (
                      <tr key={item.id} className={available === 0 ? 'bg-gray-50 text-gray-400' : ''}>
                        <td className="border border-gray-200 p-3">{item.productName}</td>
                        <td className="border border-gray-200 p-3">{item.color} / {item.size}</td>
                        <td className="border border-gray-200 p-3 text-right">LKR {item.unitPrice.toLocaleString()}</td>
                        <td className="border border-gray-200 p-3 text-right">{item.quantity}</td>
                        <td className="border border-gray-200 p-3 text-right">{alreadyReturned}</td>
                        <td className="border border-gray-200 p-3 text-right font-medium">{available}</td>
                        <td className="border border-gray-200 p-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            max={available}
                            disabled={available === 0}
                            value={quantity}
                            onChange={(e) => updateQuantity(item.id, item.quantity, Number(e.target.value))}
                            className="w-24 text-center ml-auto"
                          />
                        </td>
                        <td className="border border-gray-200 p-3 text-right">
                          LKR {(item.unitPrice * quantity).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {returnItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-800">Reason per item (optional)</h4>
                {returnItems.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantityReturned} × LKR {item.unitPrice.toLocaleString()} = LKR {item.total.toLocaleString()}
                      </p>
                    </div>
                    <Textarea
                      placeholder="Explain why this item is being returned"
                      value={itemReasons[item.id] || ''}
                      onChange={(e) => setItemReasons(prev => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
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

            <div className="space-y-3 p-3 bg-red-50 rounded">
              <div className="flex justify-between">
                <span className="font-medium">Returning against:</span>
                <span>{selectedInvoice?.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Items to Return:</span>
                <span>{returnItems.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>LKR {subtotalReturnAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'amount')}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percent (%)</SelectItem>
                      <SelectItem value="amount">Fixed (LKR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-gray-600">
                    Discount: LKR {discountAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold text-red-600">
                  <span>Total Return Amount:</span>
                  <span>LKR {totalReturnAmount.toLocaleString()}</span>
                </div>
              </div>
              {selectedInvoice?.outstandingAmount !== undefined && (
                <p className="text-xs text-gray-600">
                  Outstanding on {selectedInvoice.invoiceNumber} will drop from
                  {' '}LKR {selectedInvoice.outstandingAmount.toLocaleString()} to
                  {' '}LKR {Math.max(0, selectedInvoice.outstandingAmount - totalReturnAmount).toLocaleString()}.
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedInvoice || returnItems.length === 0 || !reason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? 'Processing...' : 'Process Return'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateReturnForm;
