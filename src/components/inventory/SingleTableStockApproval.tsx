import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, XCircle, Clock, Package, User as UserIcon, CalendarDays, Building2, CheckSquare, Square } from 'lucide-react';
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
  
  // Bulk approval states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState<string>('');
  const [agencies, setAgencies] = useState<{id: string, name: string}[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  
  const { toast } = useToast();

  const fetchPendingAdjustments = async () => {
    try {
      setLoading(true);
      
      let query = supabase
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
          transaction_id,
          agency_id
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      // Filter by agency if not superuser viewing all agencies
      if (selectedAgencyId && selectedAgencyId !== 'all') {
        query = query.eq('agency_id', selectedAgencyId);
      }

      // Filter by date if specified
      if (filterDate) {
        const startOfDay = new Date(filterDate);
        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      setPendingAdjustments(data || []);
      // Clear selection when data changes
      setSelectedIds(new Set());
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

  // Bulk approval functions
  const bulkApproveSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      setBulkProcessing(true);
      
      const { error } = await supabase
        .from('external_inventory_management')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_by_name: user.name,
          approved_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: "Bulk Approval Completed",
        description: `Successfully approved ${selectedIds.size} stock adjustments`,
      });

      await fetchPendingAdjustments();
      onApprovalComplete();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk approving adjustments:', error);
      toast({
        title: "Error",
        description: "Failed to bulk approve adjustments",
        variant: "destructive"
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkRejectSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      setBulkProcessing(true);
      
      // Get current notes for selected adjustments
      const { data: adjustments } = await supabase
        .from('external_inventory_management')
        .select('id, notes')
        .in('id', Array.from(selectedIds));

      // Update each with rejection reason
      const updates = adjustments?.map(adj => ({
        id: adj.id,
        approval_status: 'rejected',
        approved_by: user.id,
        approved_by_name: user.name,
        approved_at: new Date().toISOString(),
        notes: `${adj.notes || ''}\n\nBULK REJECTED: ${rejectionReason}`
      })) || [];

      for (const update of updates) {
        const { error } = await supabase
          .from('external_inventory_management')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: "Bulk Rejection Completed",
        description: `Successfully rejected ${selectedIds.size} stock adjustments`,
      });

      await fetchPendingAdjustments();
      onApprovalComplete();
      setSelectedIds(new Set());
      setShowBulkRejectDialog(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error bulk rejecting adjustments:', error);
      toast({
        title: "Error",
        description: "Failed to bulk reject adjustments",
        variant: "destructive"
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingAdjustments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingAdjustments.map(adj => adj.id)));
    }
  };

  // Filter by date range for bulk operations
  const bulkApproveByDate = async () => {
    if (!filterDate) {
      toast({
        title: "Date Required",
        description: "Please select a date to bulk approve adjustments",
        variant: "destructive"
      });
      return;
    }

    const adjustmentsToApprove = pendingAdjustments.filter(adj => {
      const adjDate = new Date(adj.created_at).toDateString();
      const filterDateStr = new Date(filterDate).toDateString();
      return adjDate === filterDateStr;
    });

    if (adjustmentsToApprove.length === 0) {
      toast({
        title: "No Adjustments Found",
        description: "No pending adjustments found for the selected date",
        variant: "destructive"
      });
      return;
    }

    const idsToApprove = adjustmentsToApprove.map(adj => adj.id);
    setSelectedIds(new Set(idsToApprove));
    
    // Auto-approve after setting selection
    setTimeout(() => {
      bulkApproveSelected();
    }, 100);
  };

  // Fetch agencies for superuser filtering
  const fetchAgencies = async () => {
    if (user.role !== 'superuser') return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id, name')
        .not('agency_id', 'is', null);

      if (error) throw error;

      const uniqueAgencies = new Map();
      data?.forEach(profile => {
        if (!uniqueAgencies.has(profile.agency_id)) {
          uniqueAgencies.set(profile.agency_id, {
            id: profile.agency_id,
            name: profile.name
          });
        }
      });

      setAgencies(Array.from(uniqueAgencies.values()));
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  useEffect(() => {
    if (user.role === 'superuser') {
      fetchAgencies();
    }
  }, [user.role]);

  useEffect(() => {
    fetchPendingAdjustments();
  }, [selectedAgencyId, filterDate]);

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
          
          {/* Bulk Operations Controls */}
          <div className="border-b pb-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Date
                </label>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              {/* Agency filter for superusers */}
              {user.role === 'superuser' && agencies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Agency Filter
                  </label>
                  <Select value={selectedAgencyId} onValueChange={(value) => {
                    // This will trigger fetchPendingAdjustments through useEffect
                    // But we need to update the parent component's selectedAgencyId
                    // For now, we'll work with the current selectedAgencyId
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Agencies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agencies</SelectItem>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-end">
                <Button
                  onClick={bulkApproveByDate}
                  disabled={!filterDate || bulkProcessing}
                  className="bg-blue-600 hover:bg-blue-700 w-full"
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Approve All for Date
                </Button>
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={() => setFilterDate('')}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filter
                </Button>
              </div>
              
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-gray-600">
                  {selectedIds.size} selected
                </span>
              </div>
            </div>

            {/* Bulk Action Buttons */}
            {selectedIds.size > 0 && (
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={bulkApproveSelected}
                  disabled={bulkProcessing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Bulk Approve ({selectedIds.size})
                </Button>
                <Button
                  onClick={() => setShowBulkRejectDialog(true)}
                  disabled={bulkProcessing}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Bulk Reject ({selectedIds.size})
                </Button>
              </div>
            )}

            {/* Select All/None */}
            {pendingAdjustments.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  onClick={toggleSelectAll}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  {selectedIds.size === pendingAdjustments.length ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Select All
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            {pendingAdjustments.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Adjustments</h3>
                <p className="text-gray-600">All stock adjustments have been processed.</p>
              </div>
            ) : (
              pendingAdjustments.map((adjustment) => (
                <Card key={adjustment.id} className={`border-orange-200 ${selectedIds.has(adjustment.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selectedIds.has(adjustment.id)}
                          onCheckedChange={() => toggleSelection(adjustment.id)}
                          className="mt-1"
                        />
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

      {/* Bulk Reject Dialog */}
      <Dialog open={showBulkRejectDialog} onOpenChange={() => setShowBulkRejectDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reject Stock Adjustments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to reject {selectedIds.size} stock adjustments?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (required)
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting these adjustments..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowBulkRejectDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={bulkRejectSelected}
                disabled={!rejectionReason.trim() || bulkProcessing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {bulkProcessing ? 'Processing...' : `Reject ${selectedIds.size} Adjustments`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SingleTableStockApproval;
