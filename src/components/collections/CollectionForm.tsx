import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, MapPin, Navigation } from 'lucide-react';
import { CollectionFormData, ChequeDetail } from '@/types/collections';

interface CollectionFormProps {
  customerId: string;
  customerName: string;
  onSubmit: (data: CollectionFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const CollectionForm: React.FC<CollectionFormProps> = ({
  customerId,
  customerName,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState<CollectionFormData>({
    customerId: customerId,
    customerName: customerName,
    totalAmount: 0,
    paymentMethod: 'cash',
    cashAmount: 0,
    chequeAmount: 0,
    cashDate: new Date(),
    chequeDetails: [],
    selectedInvoiceIds: [],
    notes: '',
    gpsCoordinates: { latitude: 0, longitude: 0 }
  });

  const [newCheque, setNewCheque] = useState<Omit<ChequeDetail, 'id' | 'status' | 'clearedAt'>>({
    chequeNumber: '',
    bankName: '',
    amount: 0,
    chequeDate: new Date()
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'capturing' | 'success' | 'error'>('idle');

  // Calculate total amount automatically
  const calculateTotalAmount = () => {
    return formData.cashAmount + formData.chequeAmount;
  };

  // Capture GPS coordinates
  const captureGPS = () => {
    setGpsStatus('capturing');
    
    if (!navigator.geolocation) {
      setGpsStatus('error');
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          gpsCoordinates: { latitude, longitude }
        }));
        setGpsStatus('success');
      },
      (error) => {
        console.error('Error getting location:', error);
        setGpsStatus('error');
        alert('Failed to get location. Please try again or enter manually.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  useEffect(() => {
    // Auto-capture GPS on component mount
    captureGPS();
  }, []);

  const handleInputChange = (field: keyof CollectionFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePaymentMethodChange = (method: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethod: method,
      cashAmount: method === 'cheque' ? 0 : prev.cashAmount,
      chequeAmount: method === 'cash' ? 0 : prev.chequeAmount
    }));
  };

  const addCheque = () => {
    if (newCheque.chequeNumber && newCheque.bankName && newCheque.amount > 0) {
      setFormData(prev => ({
        ...prev,
        chequeDetails: [...prev.chequeDetails, newCheque],
        chequeAmount: prev.chequeAmount + newCheque.amount
      }));
      setNewCheque({
        chequeNumber: '',
        bankName: '',
        amount: 0,
        chequeDate: new Date()
      });
    }
  };

  const removeCheque = (index: number) => {
    setFormData(prev => ({
      ...prev,
      chequeDetails: prev.chequeDetails.filter((_, i) => i !== index),
      chequeAmount: prev.chequeDetails.reduce((sum, cheque, i) => 
        i === index ? sum : sum + cheque.amount, 0
      )
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate total amount
    const total = calculateTotalAmount();
    
    if (total <= 0) {
      alert('Total amount must be greater than 0');
      return;
    }

    if (formData.paymentMethod === 'cheque' && formData.chequeDetails.length === 0) {
      alert('Please add at least one cheque');
      return;
    }

    onSubmit({
      ...formData,
      totalAmount: total
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Record Payment Collection</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                placeholder="Enter customer name"
                required
              />
            </div>
            <div>
              <Label htmlFor="totalAmount">Total Amount (LKR)</Label>
              <Input
                id="totalAmount"
                type="number"
                value={calculateTotalAmount().toFixed(2)}
                readOnly
                placeholder="0.00"
                step="0.01"
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select
              value={formData.paymentMethod}
              onValueChange={handlePaymentMethodChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="mixed">Mixed (Cash + Cheque)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cash Payment */}
          {(formData.paymentMethod === 'cash' || formData.paymentMethod === 'mixed') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cashAmount">Cash Amount (LKR)</Label>
                <Input
                  id="cashAmount"
                  type="number"
                  value={formData.cashAmount}
                  onChange={(e) => handleInputChange('cashAmount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cashDate">Cash Date</Label>
                <Input
                  id="cashDate"
                  type="date"
                  value={formData.cashDate.toISOString().split('T')[0]}
                  onChange={(e) => handleInputChange('cashDate', new Date(e.target.value))}
                  required
                />
              </div>
            </div>
          )}

          {/* Cheque Payment */}
          {(formData.paymentMethod === 'cheque' || formData.paymentMethod === 'mixed') && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="chequeAmount">Total Cheque Amount (LKR)</Label>
                  <Input
                    id="chequeAmount"
                    type="number"
                    value={formData.chequeAmount.toFixed(2)}
                    readOnly
                    placeholder="0.00"
                    step="0.01"
                    className="bg-gray-50"
                  />
                </div>
              </div>

              {/* Add Cheque Form */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Add Cheque Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="chequeNumber">Cheque Number</Label>
                    <Input
                      id="chequeNumber"
                      value={newCheque.chequeNumber}
                      onChange={(e) => setNewCheque(prev => ({ ...prev, chequeNumber: e.target.value }))}
                      placeholder="Enter cheque number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={newCheque.bankName}
                      onChange={(e) => setNewCheque(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="Enter bank name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="chequeAmount">Amount (LKR)</Label>
                    <Input
                      id="chequeAmount"
                      type="number"
                      value={newCheque.amount}
                      onChange={(e) => setNewCheque(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="chequeDate">Cheque Date</Label>
                    <Input
                      id="chequeDate"
                      type="date"
                      value={newCheque.chequeDate.toISOString().split('T')[0]}
                      onChange={(e) => setNewCheque(prev => ({ ...prev, chequeDate: new Date(e.target.value) }))}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={addCheque}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cheque
                </Button>
              </div>

              {/* Cheque List */}
              {formData.chequeDetails.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Added Cheques</h4>
                  {formData.chequeDetails.map((cheque, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{cheque.chequeNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {cheque.bankName} • {cheque.chequeDate.toLocaleDateString()} • LKR {cheque.amount.toFixed(2)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCheque(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GPS Coordinates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>GPS Coordinates</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureGPS}
                disabled={gpsStatus === 'capturing'}
                className="flex items-center gap-2"
              >
                <Navigation className="h-4 w-4" />
                {gpsStatus === 'capturing' ? 'Capturing...' : 'Capture GPS'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.gpsCoordinates.latitude}
                  readOnly
                  placeholder="0.000000"
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.gpsCoordinates.longitude}
                  readOnly
                  placeholder="0.000000"
                  className="bg-gray-50"
                />
              </div>
            </div>
            
            {gpsStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <MapPin className="h-4 w-4" />
                GPS coordinates captured successfully
              </div>
            )}
            
            {gpsStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <MapPin className="h-4 w-4" />
                Failed to capture GPS coordinates
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording...' : 'Record Collection'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}; 