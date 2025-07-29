import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  User as UserIcon, 
  Calendar,
  ArrowUp,
  ArrowDown,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StockAdjustment {
  id: string;
  product_id: string;
  product_name: string;
  color: string;
  size: string;
  adjustment_type: 'increase' | 'decrease';
  quantity: number;
  current_stock: number;
  new_stock: number;
  reason: string;
  justification: string;
  requested_by: string;
  agency_id: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  requester_name?: string;
  reviewer_name?: string;
}

interface StockAdjustmentApprovalProps {
  user: User;
  onClose: () => void;
  onApprovalComplete: () => void;
}

const StockAdjustmentApproval = ({ user, onClose, onApprovalComplete }: StockAdjustmentApprovalProps) => {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      
      // Fetch adjustments with requester and reviewer names
      const { data, error } = await supabase
        .from('stock_adjustments')
        .select(`
          *,
          requester:profiles!stock_adjustments_requested_by_fkey(name),
          reviewer:profiles!stock_adjustments_reviewed_by_fkey(name)
        `)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching adjustments:', error);
        toast({
          title: "Error",
          description: "Failed to fetch stock adjustments",
          variant: "destructive"
        });
        return;
      }

      // Transform the data to include names
      const transformedData = (data || []).map(item => ({
        ...item,
        requester_name: item.requester?.name || 'Unknown',
        reviewer_name: item.reviewer?.name || null
      }));

      setAdjustments(transformedData);
    } catch (error) {
      console.error('Error fetching adjustments:', error);
      toast({
        title: "Error",
        description: "Failed to load adjustments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const handleApproval = async (adjustmentId: string, action: 'approve' | 'reject') => {
    if (processingId) return;

    setProcessingId(adjustmentId);

    try {
      const adjustment = adjustments.find(a => a.id === adjustmentId);
      if (!adjustment) return;

      const notes = reviewNotes[adjustmentId] || '';

      const { error } = await supabase
        .from('stock_adjustments')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null
        })
        .eq('id', adjustmentId);

      if (error) {
        console.error('Error updating adjustment:', error);
        toast({
          title: "Error",
          description: `Failed to ${action} adjustment`,
          variant: "destructive"
        });
      } else {
        toast({
          title: `Adjustment ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          description: `Stock adjustment has been ${action === 'approve' ? 'approved' : 'rejected'}${
            action === 'approve' ? ' and inventory updated' : ''
          }`,
          variant: action === 'approve' ? 'default' : 'destructive'
        });

        // Refresh the data
        await fetchAdjustments();
        onApprovalComplete();
      }
    } catch (error) {
      console.error('Error processing adjustment:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const renderAdjustmentCard = (adjustment: StockAdjustment) => (
    <Card key={adjustment.id} className="mb-4">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              adjustment.adjustment_type === 'increase' 
                ? 'bg-green-100 text-green-600' 
                : 'bg-red-100 text-red-600'
            }`}>
              {adjustment.adjustment_type === 'increase' ? 
                <ArrowUp className="h-5 w-5" /> : 
                <ArrowDown className="h-5 w-5" />
              }
            </div>
            <div>
              <h3 className="font-semibold">{adjustment.product_name}</h3>
              <p className="text-sm text-gray-600">
                {adjustment.color} • {adjustment.size}
              </p>
            </div>
          </div>
          {getStatusBadge(adjustment.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Current Stock</p>
            <p className="text-xl font-semibold">{adjustment.current_stock}</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${
            adjustment.adjustment_type === 'increase' 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            <p className="text-sm">
              {adjustment.adjustment_type === 'increase' ? 'Adding' : 'Removing'}
            </p>
            <p className="text-xl font-semibold">
              {adjustment.adjustment_type === 'increase' ? '+' : '-'}{adjustment.quantity}
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">New Stock</p>
            <p className="text-xl font-semibold text-blue-700">{adjustment.new_stock}</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <p className="text-sm font-medium">Reason:</p>
            <p className="text-sm text-gray-700">{adjustment.reason}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Justification:</p>
            <p className="text-sm text-gray-700">{adjustment.justification}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>Requested by: {adjustment.requester_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{new Date(adjustment.requested_at).toLocaleDateString()}</span>
          </div>
        </div>

        {adjustment.status === 'pending' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`notes-${adjustment.id}`}>Review Notes (Optional)</Label>
              <Textarea
                id={`notes-${adjustment.id}`}
                placeholder="Add any notes about this decision..."
                value={reviewNotes[adjustment.id] || ''}
                onChange={(e) => setReviewNotes(prev => ({
                  ...prev,
                  [adjustment.id]: e.target.value
                }))}
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => handleApproval(adjustment.id, 'approve')}
                disabled={processingId === adjustment.id}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {processingId === adjustment.id ? 'Processing...' : 'Approve'}
              </Button>
              <Button
                onClick={() => handleApproval(adjustment.id, 'reject')}
                disabled={processingId === adjustment.id}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {processingId === adjustment.id ? 'Processing...' : 'Reject'}
              </Button>
            </div>
          </div>
        )}

        {adjustment.status !== 'pending' && adjustment.review_notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">Review Notes:</span>
            </div>
            <p className="text-sm text-gray-700">{adjustment.review_notes}</p>
            {adjustment.reviewer_name && (
              <p className="text-xs text-gray-500 mt-1">
                By {adjustment.reviewer_name} on {new Date(adjustment.reviewed_at!).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const pendingAdjustments = adjustments.filter(a => a.status === 'pending');
  const reviewedAdjustments = adjustments.filter(a => a.status !== 'pending');

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading stock adjustments...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Adjustment Approvals
          </CardTitle>
          <p className="text-sm text-gray-600">
            Review and approve stock adjustment requests from agencies
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs defaultValue="pending" className="h-full">
            <div className="px-6 py-2 border-b">
              <TabsList>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending ({pendingAdjustments.length})
                </TabsTrigger>
                <TabsTrigger value="reviewed" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Reviewed ({reviewedAdjustments.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-[calc(90vh-200px)] overflow-y-auto">
              <TabsContent value="pending" className="m-0 p-6">
                {pendingAdjustments.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Adjustments</h3>
                    <p className="text-gray-600">All adjustment requests have been reviewed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAdjustments.map(renderAdjustmentCard)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reviewed" className="m-0 p-6">
                {reviewedAdjustments.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviewed Adjustments</h3>
                    <p className="text-gray-600">No adjustments have been reviewed yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviewedAdjustments.map(renderAdjustmentCard)}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>

        <div className="px-6 py-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default StockAdjustmentApproval;