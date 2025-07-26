import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collection, InvoiceSummary } from '@/types/collections';

interface CollectionAllocationProps {
  collection: Collection;
  invoices: InvoiceSummary[];
  onAllocate: (allocations: { invoiceId: string; amount: number }[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const CollectionAllocation: React.FC<CollectionAllocationProps> = ({
  collection,
  invoices,
  onAllocate,
  onCancel,
  loading = false
}) => {
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: number }>({});
  const [totalAllocated, setTotalAllocated] = useState(0);

  const handleAllocationChange = (invoiceId: string, amount: number) => {
    const newAllocations = { ...allocations, [invoiceId]: amount };
    const total = Object.values(newAllocations).reduce((sum, amt) => sum + amt, 0);
    
    setAllocations(newAllocations);
    setTotalAllocated(total);
  };

  const handleSubmit = () => {
    const allocationList = Object.entries(allocations)
      .filter(([_, amount]) => amount > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }));

    onAllocate(allocationList);
  };

  const remainingAmount = collection.totalAmount - totalAllocated;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Allocate Collection to Invoices</CardTitle>
        <div className="text-sm text-muted-foreground">
          Collection: LKR {collection.totalAmount.toFixed(2)} • Customer: {collection.customerName}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Collection</div>
              <div className="text-2xl font-bold">LKR {collection.totalAmount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Allocated</div>
              <div className="text-2xl font-bold text-green-600">LKR {totalAllocated.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Remaining</div>
              <div className={`text-2xl font-bold ${remainingAmount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                LKR {remainingAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Available Invoices</h3>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No outstanding invoices found for this customer.
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">Invoice #{invoice.id}</div>
                      <div className="text-sm text-muted-foreground">
                        Outstanding: LKR {invoice.outstandingAmount.toFixed(2)} • 
                        Total: LKR {invoice.total.toFixed(2)} • 
                        Created: {invoice.createdAt.toLocaleDateString()}
                      </div>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {invoice.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`alloc-${invoice.id}`} className="text-sm">
                        Allocate:
                      </Label>
                      <Input
                        id={`alloc-${invoice.id}`}
                        type="number"
                        value={allocations[invoice.id] || 0}
                        onChange={(e) => handleAllocationChange(invoice.id, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={invoice.outstandingAmount}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        / LKR {invoice.outstandingAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || totalAllocated <= 0 || remainingAmount < 0}
            >
              {loading ? 'Allocating...' : 'Allocate Collection'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 