import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, Package, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PendingAdjustment {
  id: string;
  product_name: string;
  product_code: string | null;
  color: string;
  size: string;
  category: string;
  sub_category: string;
  quantity: number;
  reference_name: string;
  user_name: string;
  notes: string;
  requested_by: string;
  requested_by_name: string;
  created_at: string;
  transaction_id: string;
}

interface SingleTableStockApprovalProps {
  user: User;
  selectedAgencyId: string;
  onClose: () => void;
  onApprovalComplete: () => void;
}

const SingleTableStockApproval = ({ 
  user, 
  selectedAgencyId, 
  onClose, 
  onApprovalComplete 
}: SingleTableStockApprovalProps) => {
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<PendingAdjustment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const { toast } = useToast();

  const fetchPendingAdjustments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('external_inventory_management')
        .select(`
          id,
          product_name,
          product_code,
          color,
          size,
          category,
          sub_category,
          quantity,
          reference_name,
          user_name,
          notes,
          requested_by,
          requested_by_name,
          created_at,
          transaction_id
        `)
        .eq('agency_id', selectedAgencyId)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPendingAdjustments(data || []);
    } catch (error) {
      console.error('Error fetching pending adjustments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending adjustments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const approveAdjustment = async (adjustment: PendingAdjustment) => {
    try {
      setProcessing(adjustment.id);
      
      const { error } = await supabase
        .from('external_inventory_management')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_by_name: user.name,
          approved_at: new Date().toISOString()
        })
        .eq('id', adjustment.id);

      if (error) throw error;

      toast({
        title: "Adjustment Approved",
        description: `Stock adjustment for ${adjustment.product_name} has been approved`,
      });

      await fetchPendingAdjustments();
      onApprovalComplete();
    } catch (error) {
      console.error('Error approving adjustment:', error);
      toast({
        title: "Error",
        description: "Failed to approve adjustment",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const rejectAdjustment = async () => {
    if (!selectedAdjustment) return;

    try {
      setProcessing(selectedAdjustment.id);
      
      const { error } = await supabase
        .from('external_inventory_management')
        .update({
          approval_status: 'rejected',
          approved_by: user.id,
          approved_by_name: user.name,
          approved_at: new Date().toISOString(),
          notes: `${selectedAdjustment.notes}\n\nREJECTED: ${rejectionReason}`
        })
        .eq('id', selectedAdjustment.id);

      if (error) throw error;

      toast({
        title: "Adjustment Rejected",
        description: `Stock adjustment for ${selectedAdjustment.product_name} has been rejected`,
      });

      await fetchPendingAdjustments();
      onApprovalComplete();
      setShowRejectDialog(false);
      setSelectedAdjustment(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting adjustment:', error);
      toast({
        title: "Error",
        description: "Failed to reject adjustment",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    fetchPendingAdjustments();
  }, [selectedAgencyId]);

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Adjustment Approvals</DialogTitle>
          </DialogHeader>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pending adjustments...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Stock Adjustment Approvals ({pendingAdjustments.length} pending)
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {pendingAdjustments.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Adjustments</h3>
                <p className="text-gray-600">All stock adjustments have been processed.</p>
              </div>
            ) : (
              pendingAdjustments.map((adjustment) => (
                <Card key={adjustment.id} className="border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Package className="h-8 w-8 text-orange-600" />
                        <div>
                          <h4 className="font-semibold text-lg">{adjustment.product_name}</h4>
                          <div className="flex gap-2 text-sm text-gray-600 mt-1">
                            {adjustment.product_code && (
                              <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {adjustment.product_code}
                              </span>
                            )}
                            <span>Color: {adjustment.color}</span>
                            <span>Size: {adjustment.size}</span>
                            <span>Category: {adjustment.sub_category}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <UserIcon className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Requested by: {adjustment.requested_by_name}
                            </span>
                            <span className="text-sm text-gray-500">
                              on {new Date(adjustment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Adjustment</p>
                          <p className={`text-2xl font-bold ${
                            adjustment.quantity > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
                          </p>
                        </div>

                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          Pending Approval
                        </Badge>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => approveAdjustment(adjustment)}
                            disabled={processing === adjustment.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedAdjustment(adjustment);
                              setShowRejectDialog(true);
                            }}
                            disabled={processing === adjustment.id}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>

                    {adjustment.notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>Notes:</strong> {adjustment.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={() => setShowRejectDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Stock Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to reject the stock adjustment for {selectedAdjustment?.product_name}?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this adjustment..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowRejectDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={rejectAdjustment}
                disabled={!rejectionReason.trim() || processing === selectedAdjustment?.id}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reject Adjustment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SingleTableStockApproval;