import { useState } from 'react';
import { User } from '@/types/auth';
import { GRN } from '@/types/grn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, FileText, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GRNAcceptanceProps {
  user: User;
  grns: GRN[];
  onGRNProcessed: (grnId: string, action: 'accepted' | 'rejected', reason?: string) => void;
}

const GRNAcceptance = ({ user, grns, onGRNProcessed }: GRNAcceptanceProps) => {
  const { toast } = useToast();
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Only show if user is agency or agent role and filter GRNs for current agency
  if (user.role !== 'agency' && user.role !== 'agent') {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only agency and agent users can access GRN acceptance.</p>
      </div>
    );
  }

  // Filter GRNs for current agency only
  const pendingGRNs = grns.filter(grn => 
    grn.agencyId === user.agencyId && grn.status === 'pending'
  );

  const processedGRNs = grns.filter(grn => 
    grn.agencyId === user.agencyId && grn.status !== 'pending'
  );

  const handleAccept = (grn: GRN) => {
    onGRNProcessed(grn.id, 'accepted');
    setSelectedGRN(null);
    toast({
      title: "GRN Accepted",
      description: "Stock has been added to your inventory."
    });
  };

  const handleReject = (grn: GRN) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejecting this GRN.",
        variant: "destructive"
      });
      return;
    }

    onGRNProcessed(grn.id, 'rejected', rejectionReason);
    setSelectedGRN(null);
    setRejectionReason('');
    toast({
      title: "GRN Rejected",
      description: "Superuser has been notified of the rejection."
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'accepted':
        return <Badge variant="default" className="bg-green-600">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (selectedGRN) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelectedGRN(null)}>
            ← Back to GRN List
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>GRN Details - {selectedGRN.id}</CardTitle>
                <p className="text-gray-600 mt-1">Invoice: {selectedGRN.invoiceFileName}</p>
              </div>
              {getStatusBadge(selectedGRN.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* GRN Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Assigned Date:</strong> {selectedGRN.assignedAt.toLocaleDateString()}</p>
                <p><strong>Uploaded By:</strong> {selectedGRN.uploadedBy}</p>
              </div>
              <div>
                <p><strong>Total Amount:</strong> LKR {selectedGRN.total.toLocaleString()}</p>
                <p><strong>Items Count:</strong> {selectedGRN.items.length}</p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="font-semibold mb-3">Items to be Received</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Product</th>
                      <th className="text-left p-3">Color/Size</th>
                      <th className="text-right p-3">Quantity</th>
                      <th className="text-right p-3">Unit Price</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGRN.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">{item.productName}</td>
                        <td className="p-3">{item.color}, {item.size}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right">LKR {item.unitPrice.toLocaleString()}</td>
                        <td className="p-3 text-right">LKR {item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            {selectedGRN.status === 'pending' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rejection Reason (if rejecting):
                  </label>
                  <Textarea
                    placeholder="Please provide reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={() => handleAccept(selectedGRN)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accept GRN & Add to Inventory
                  </Button>
                  <Button 
                    onClick={() => handleReject(selectedGRN)}
                    variant="destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject GRN
                  </Button>
                </div>
              </div>
            )}

            {selectedGRN.status === 'rejected' && selectedGRN.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Rejection Reason:</h4>
                <p className="text-red-700">{selectedGRN.rejectionReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">GRN Acceptance</h2>
        <p className="text-gray-600">Review and accept/reject goods receipt notes for {user.agencyName}</p>
      </div>

      {/* Pending GRNs */}
      {pendingGRNs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Pending GRNs ({pendingGRNs.length})</h3>
          {pendingGRNs.map((grn) => (
            <Card key={grn.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{grn.id}</h4>
                      {getStatusBadge(grn.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Invoice: {grn.invoiceFileName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {grn.items.length} items • Total: LKR {grn.total.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Assigned: {grn.assignedAt.toLocaleDateString()} by {grn.uploadedBy}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setSelectedGRN(grn)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Review GRN
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Processed GRNs */}
      {processedGRNs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Processed GRNs</h3>
          {processedGRNs.map((grn) => (
            <Card key={grn.id} className="opacity-75">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{grn.id}</h4>
                      {getStatusBadge(grn.status)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {grn.items.length} items • LKR {grn.total.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Processed: {grn.processedAt?.toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedGRN(grn)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {pendingGRNs.length === 0 && processedGRNs.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No GRNs Available</h3>
          <p className="text-gray-600">
            No goods receipt notes have been assigned to {user.agencyName} yet.
          </p>
        </div>
      )}
    </div>
  );
};

export default GRNAcceptance;
