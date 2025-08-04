import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { X, Check, AlertTriangle, Package, Clock, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ExternalStockAdjustmentApprovalProps {
  user: User;
  onClose: () => void;
  onApprovalComplete: () => void;
  selectedAgencyId?: string; // For superusers to view other agencies
}

interface PendingAdjustment {
  id: string;
  product_name: string;
  product_code?: string;
  color: string;
  size: string;
  category?: string;
  current_stock: number;
  adjustment_quantity: number;
  new_stock: number;
  reason: string;
  notes?: string;
  adjustment_type: string;
  requested_by_name: string;
  requested_at: string;
  batch_id?: string;
  batch_name?: string;
  agency_id: string;
}

interface BatchGroup {
  batch_id: string;
  batch_name: string;
  adjustments: PendingAdjustment[];
  requested_by_name: string;
  requested_at: string;
  total_items: number;
  total_adjustment_value: number;
}

const ExternalStockAdjustmentApproval = ({ user, onClose, onApprovalComplete, selectedAgencyId }: ExternalStockAdjustmentApprovalProps) => {
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([]);
  const [individualAdjustments, setIndividualAdjustments] = useState<PendingAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user.role === 'superuser') {
      fetchPendingAdjustments();
    }
  }, [user.role, selectedAgencyId]);

  const fetchPendingAdjustments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('external_stock_adjustments_pending')
        .select('*');

      // Filter by agency if selectedAgencyId is provided
      if (selectedAgencyId) {
        query = query.eq('agency_id', selectedAgencyId);
      }

      const { data, error } = await query.order('requested_at', { ascending: true });

      if (error) throw error;

      setPendingAdjustments(data || []);
      groupAdjustments(data || []);
    } catch (error: any) {
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

  const groupAdjustments = (adjustments: PendingAdjustment[]) => {
    const batched: { [key: string]: PendingAdjustment[] } = {};
    const individual: PendingAdjustment[] = [];

    adjustments.forEach(adj => {
      if (adj.batch_id) {
        if (!batched[adj.batch_id]) {
          batched[adj.batch_id] = [];
        }
        batched[adj.batch_id].push(adj);
      } else {
        individual.push(adj);
      }
    });

    const batchGroups: BatchGroup[] = Object.entries(batched).map(([batchId, batchAdjustments]) => {
      const firstAdjustment = batchAdjustments[0];
      const totalAdjustmentValue = batchAdjustments.reduce((sum, adj) => 
        sum + (adj.adjustment_quantity * (adj.current_stock > 0 ? 1 : 0)), 0
      );

      return {
        batch_id: batchId,
        batch_name: firstAdjustment.batch_name || `Batch ${batchId.slice(0, 8)}`,
        adjustments: batchAdjustments,
        requested_by_name: firstAdjustment.requested_by_name,
        requested_at: firstAdjustment.requested_at,
        total_items: batchAdjustments.length,
        total_adjustment_value: totalAdjustmentValue
      };
    });

    setBatchGroups(batchGroups);
    setIndividualAdjustments(individual);
  };

  const approveAdjustment = async (adjustmentId: string) => {
    try {
      setProcessing(adjustmentId);
      
      const { data, error } = await supabase.rpc('approve_external_stock_adjustment', {
        p_adjustment_id: adjustmentId,
        p_reviewer_id: user.id,
        p_reviewer_name: user.name
      });

      if (error) throw error;

      toast({
        title: "Adjustment Approved",
        description: "Stock adjustment has been approved and applied",
      });

      // Refresh the list
      await fetchPendingAdjustments();
      onApprovalComplete();

    } catch (error: any) {
      console.error('Error approving adjustment:', error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve adjustment",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const rejectAdjustment = async (adjustmentId: string) => {
    try {
      setProcessing(adjustmentId);
      
      const { data, error } = await supabase.rpc('reject_external_stock_adjustment', {
        p_adjustment_id: adjustmentId,
        p_reviewer_id: user.id,
        p_reviewer_name: user.name,
        p_rejection_reason: rejectionReason || null
      });

      if (error) throw error;

      toast({
        title: "Adjustment Rejected",
        description: "Stock adjustment has been rejected",
      });

      // Reset rejection dialog
      setShowRejectionDialog(null);
      setRejectionReason('');

      // Refresh the list
      await fetchPendingAdjustments();
      onApprovalComplete();

    } catch (error: any) {
      console.error('Error rejecting adjustment:', error);
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject adjustment",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const approveBatch = async (batchId: string) => {
    const batch = batchGroups.find(b => b.batch_id === batchId);
    if (!batch) return;

    try {
      setProcessing(batchId);
      
      // Approve all adjustments in the batch
      for (const adjustment of batch.adjustments) {
        const { error } = await supabase.rpc('approve_external_stock_adjustment', {
          p_adjustment_id: adjustment.id,
          p_reviewer_id: user.id,
          p_reviewer_name: user.name
        });

        if (error) {
          throw new Error(`Failed to approve ${adjustment.product_name}: ${error.message}`);
        }
      }

      toast({
        title: "Batch Approved",
        description: `Successfully approved ${batch.total_items} stock adjustments`,
      });

      // Refresh the list
      await fetchPendingAdjustments();
      onApprovalComplete();

    } catch (error: any) {
      console.error('Error approving batch:', error);
      toast({
        title: "Batch Approval Failed",
        description: error.message || "Failed to approve batch",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const rejectBatch = async (batchId: string) => {
    const batch = batchGroups.find(b => b.batch_id === batchId);
    if (!batch) return;

    try {
      setProcessing(batchId);
      
      // Reject all adjustments in the batch
      for (const adjustment of batch.adjustments) {
        const { error } = await supabase.rpc('reject_external_stock_adjustment', {
          p_adjustment_id: adjustment.id,
          p_reviewer_id: user.id,
          p_reviewer_name: user.name,
          p_rejection_reason: rejectionReason || null
        });

        if (error) {
          throw new Error(`Failed to reject ${adjustment.product_name}: ${error.message}`);
        }
      }

      toast({
        title: "Batch Rejected",
        description: `Successfully rejected ${batch.total_items} stock adjustments`,
      });

      // Reset rejection dialog
      setShowRejectionDialog(null);
      setRejectionReason('');

      // Refresh the list
      await fetchPendingAdjustments();
      onApprovalComplete();

    } catch (error: any) {
      console.error('Error rejecting batch:', error);
      toast({
        title: "Batch Rejection Failed",
        description: error.message || "Failed to reject batch",
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  if (user.role !== 'superuser') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">Only super users can approve stock adjustments.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold">Stock Adjustment Approvals</h2>
              <p className="text-sm text-gray-600">Review and approve pending external stock adjustments</p>
            </div>
            <Button variant="ghost" onClick={onClose} className="p-2">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading pending adjustments...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Batch Adjustments */}
                {batchGroups.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Batch Adjustments ({batchGroups.length})</h3>
                    <div className="space-y-4">
                      {batchGroups.map((batch) => (
                        <Card key={batch.batch_id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{batch.batch_name}</CardTitle>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                  <div className="flex items-center gap-1">
                                    <UserIcon className="h-4 w-4" />
                                    {batch.requested_by_name}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {new Date(batch.requested_at).toLocaleString()}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Package className="h-4 w-4" />
                                    {batch.total_items} items
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowRejectionDialog(batch.batch_id)}
                                  disabled={processing === batch.batch_id}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject Batch
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => approveBatch(batch.batch_id)}
                                  disabled={processing === batch.batch_id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {processing === batch.batch_id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                                  ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                  )}
                                  Approve Batch
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {batch.adjustments.map((adjustment) => (
                                <div key={adjustment.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex-1">
                                    <div className="font-medium">{adjustment.product_name}</div>
                                    <div className="text-sm text-gray-600 flex gap-2">
                                      {adjustment.product_code && (
                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{adjustment.product_code}</span>
                                      )}
                                      <span>{adjustment.color}</span>
                                      <span>•</span>
                                      <span>{adjustment.size}</span>
                                      <span>•</span>
                                      <span>{adjustment.reason}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="text-center">
                                      <div className="text-gray-600">Current</div>
                                      <div className="font-medium">{adjustment.current_stock}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-gray-600">Adjustment</div>
                                      <div className={`font-medium ${
                                        adjustment.adjustment_quantity > 0 ? 'text-green-600' : 
                                        adjustment.adjustment_quantity < 0 ? 'text-red-600' : ''
                                      }`}>
                                        {adjustment.adjustment_quantity > 0 ? '+' : ''}{adjustment.adjustment_quantity}
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-gray-600">New Stock</div>
                                      <div className={`font-medium ${
                                        adjustment.new_stock < 0 ? 'text-red-600' : ''
                                      }`}>
                                        {adjustment.new_stock}
                                      </div>
                                    </div>
                                    <Badge variant={
                                      adjustment.adjustment_type === 'bulk' ? 'default' :
                                      adjustment.adjustment_type === 'correction' ? 'secondary' :
                                      'outline'
                                    }>
                                      {adjustment.adjustment_type}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Adjustments */}
                {individualAdjustments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Individual Adjustments ({individualAdjustments.length})</h3>
                    <div className="space-y-3">
                      {individualAdjustments.map((adjustment) => (
                        <Card key={adjustment.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{adjustment.product_name}</div>
                                <div className="text-sm text-gray-600 flex gap-2 mt-1">
                                  {adjustment.product_code && (
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{adjustment.product_code}</span>
                                  )}
                                  <span>{adjustment.color}</span>
                                  <span>•</span>
                                  <span>{adjustment.size}</span>
                                  <span>•</span>
                                  <span>{adjustment.reason}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Requested by {adjustment.requested_by_name} on {new Date(adjustment.requested_at).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center text-sm">
                                  <div className="text-gray-600">Current</div>
                                  <div className="font-medium">{adjustment.current_stock}</div>
                                </div>
                                <div className="text-center text-sm">
                                  <div className="text-gray-600">Adjustment</div>
                                  <div className={`font-medium ${
                                    adjustment.adjustment_quantity > 0 ? 'text-green-600' : 
                                    adjustment.adjustment_quantity < 0 ? 'text-red-600' : ''
                                  }`}>
                                    {adjustment.adjustment_quantity > 0 ? '+' : ''}{adjustment.adjustment_quantity}
                                  </div>
                                </div>
                                <div className="text-center text-sm">
                                  <div className="text-gray-600">New Stock</div>
                                  <div className={`font-medium ${
                                    adjustment.new_stock < 0 ? 'text-red-600' : ''
                                  }`}>
                                    {adjustment.new_stock}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowRejectionDialog(adjustment.id)}
                                    disabled={processing === adjustment.id}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => approveAdjustment(adjustment.id)}
                                    disabled={processing === adjustment.id}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    {processing === adjustment.id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {batchGroups.length === 0 && individualAdjustments.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Adjustments</h3>
                    <p className="text-gray-600">All stock adjustments have been processed.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Dialog */}
      {showRejectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Adjustment</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (Optional)
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionDialog(null);
                  setRejectionReason('');
                }}
                disabled={processing === showRejectionDialog}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (showRejectionDialog.includes('-')) {
                    // It's a single adjustment ID
                    rejectAdjustment(showRejectionDialog);
                  } else {
                    // It's a batch ID
                    rejectBatch(showRejectionDialog);
                  }
                }}
                disabled={processing === showRejectionDialog}
              >
                {processing === showRejectionDialog ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExternalStockAdjustmentApproval;