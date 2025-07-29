import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Package, 
  Calendar,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  FileText
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
  reviewer_name?: string;
}

interface StockAdjustmentHistoryProps {
  user: User;
  onClose: () => void;
}

const StockAdjustmentHistory = ({ user, onClose }: StockAdjustmentHistoryProps) => {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      
      // Fetch adjustments for the current agency
      const { data, error } = await supabase
        .from('stock_adjustments')
        .select(`
          *,
          reviewer:profiles!stock_adjustments_reviewed_by_fkey(name)
        `)
        .eq('agency_id', user.agencyId)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching adjustments:', error);
        toast({
          title: "Error",
          description: "Failed to fetch stock adjustment history",
          variant: "destructive"
        });
        return;
      }

      // Transform the data to include reviewer names
      const transformedData = (data || []).map(item => ({
        ...item,
        reviewer_name: item.reviewer?.name || null
      }));

      setAdjustments(transformedData);
    } catch (error) {
      console.error('Error fetching adjustments:', error);
      toast({
        title: "Error",
        description: "Failed to load adjustment history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, [user.agencyId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Your request is waiting for superuser approval.';
      case 'approved':
        return 'Your request has been approved and inventory has been updated.';
      case 'rejected':
        return 'Your request has been rejected. See review notes for details.';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading adjustment history...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Stock Adjustment History
          </CardTitle>
          <p className="text-sm text-gray-600">
            View the status of your stock adjustment requests
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[calc(90vh-200px)] overflow-y-auto p-6">
            {adjustments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Adjustment Requests</h3>
                <p className="text-gray-600">You haven't submitted any stock adjustment requests yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {adjustments.map((adjustment) => (
                  <Card key={adjustment.id} className="border-l-4 border-l-blue-500">
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

                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {getStatusDescription(adjustment.status)}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Original Stock</p>
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
                          <Calendar className="h-4 w-4" />
                          <span>Requested: {new Date(adjustment.requested_at).toLocaleDateString()}</span>
                        </div>
                        {adjustment.reviewed_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Reviewed: {new Date(adjustment.reviewed_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {adjustment.review_notes && (
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
                ))}
              </div>
            )}
          </div>
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

export default StockAdjustmentHistory;