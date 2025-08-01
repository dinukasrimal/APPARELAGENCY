import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle, XCircle, Clock, Search, Package, User as UserIcon, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ExternalStockAdjustmentHistoryProps {
  user: User;
  onClose: () => void;
}

interface AdjustmentHistoryItem {
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
  status: 'approved' | 'rejected';
  requested_by_name: string;
  reviewed_by_name?: string;
  requested_at: string;
  reviewed_at?: string;
  batch_id?: string;
  batch_name?: string;
  agency_id: string;
}

interface BatchGroup {
  batch_id: string;
  batch_name: string;
  adjustments: AdjustmentHistoryItem[];
  requested_by_name: string;
  reviewed_by_name: string;
  requested_at: string;
  reviewed_at: string;
  total_items: number;
  status: 'approved' | 'rejected';
  total_adjustment_value: number;
}

const ExternalStockAdjustmentHistory = ({ user, onClose }: ExternalStockAdjustmentHistoryProps) => {
  const [historyItems, setHistoryItems] = useState<AdjustmentHistoryItem[]>([]);
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([]);
  const [individualAdjustments, setIndividualAdjustments] = useState<AdjustmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchAdjustmentHistory();
  }, [user.agencyId]);

  const fetchAdjustmentHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('external_stock_adjustments_history')
        .select('*')
        .eq('agency_id', user.agencyId)
        .order('reviewed_at', { ascending: false });

      if (error) throw error;

      setHistoryItems(data || []);
      groupAdjustments(data || []);
    } catch (error: any) {
      console.error('Error fetching adjustment history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch adjustment history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const groupAdjustments = (adjustments: AdjustmentHistoryItem[]) => {
    const batched: { [key: string]: AdjustmentHistoryItem[] } = {};
    const individual: AdjustmentHistoryItem[] = [];

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
        sum + Math.abs(adj.adjustment_quantity), 0
      );

      return {
        batch_id: batchId,
        batch_name: firstAdjustment.batch_name || `Batch ${batchId.slice(0, 8)}`,
        adjustments: batchAdjustments,
        requested_by_name: firstAdjustment.requested_by_name,
        reviewed_by_name: firstAdjustment.reviewed_by_name || 'System',
        requested_at: firstAdjustment.requested_at,
        reviewed_at: firstAdjustment.reviewed_at || firstAdjustment.requested_at,
        total_items: batchAdjustments.length,
        status: firstAdjustment.status,
        total_adjustment_value: totalAdjustmentValue
      };
    });

    setBatchGroups(batchGroups);
    setIndividualAdjustments(individual);
  };

  // Filter logic
  const filteredBatches = batchGroups.filter(batch => {
    const matchesSearch = batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.adjustments.some(adj => 
                           adj.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           adj.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           adj.size.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredIndividualAdjustments = individualAdjustments.filter(adj => {
    const matchesSearch = adj.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         adj.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         adj.size.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || adj.status === statusFilter;
    const matchesType = typeFilter === 'all' || adj.adjustment_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusIcon = (status: 'approved' | 'rejected') => {
    return status === 'approved' ? CheckCircle : XCircle;
  };

  const getStatusColor = (status: 'approved' | 'rejected') => {
    return status === 'approved' ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Stock Adjustment History</h2>
            <p className="text-sm text-gray-600">View completed stock adjustment requests</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="p-2">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading adjustment history...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search adjustments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="bulk">Bulk Adjustment</SelectItem>
                    <SelectItem value="correction">Stock Correction</SelectItem>
                    <SelectItem value="damage">Damage/Defect</SelectItem>
                    <SelectItem value="loss">Stock Loss</SelectItem>
                    <SelectItem value="found">Stock Found</SelectItem>
                    <SelectItem value="manual">Manual Count</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}>
                  Clear Filters
                </Button>
              </div>

              {/* Batch Adjustments */}
              {filteredBatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Batch Adjustments ({filteredBatches.length})</h3>
                  <div className="space-y-4">
                    {filteredBatches.map((batch) => {
                      const StatusIcon = getStatusIcon(batch.status);
                      
                      return (
                        <Card key={batch.batch_id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <StatusIcon className={`h-5 w-5 ${getStatusColor(batch.status)}`} />
                                  {batch.batch_name}
                                </CardTitle>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                  <div className="flex items-center gap-1">
                                    <UserIcon className="h-4 w-4" />
                                    Requested by {batch.requested_by_name}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <UserIcon className="h-4 w-4" />
                                    Reviewed by {batch.reviewed_by_name}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(batch.reviewed_at).toLocaleString()}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Package className="h-4 w-4" />
                                    {batch.total_items} items
                                  </div>
                                </div>
                              </div>
                              <Badge variant={batch.status === 'approved' ? 'default' : 'destructive'}>
                                {batch.status.toUpperCase()}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {batch.adjustments.map((adjustment) => (
                                <div key={adjustment.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
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
                                      <div className="text-gray-600">Previous</div>
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
                                      <div className="font-medium">{adjustment.new_stock}</div>
                                    </div>
                                    <Badge variant="outline">
                                      {adjustment.adjustment_type}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Adjustments */}
              {filteredIndividualAdjustments.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Individual Adjustments ({filteredIndividualAdjustments.length})</h3>
                  <div className="space-y-3">
                    {filteredIndividualAdjustments.map((adjustment) => {
                      const StatusIcon = getStatusIcon(adjustment.status);
                      
                      return (
                        <Card key={adjustment.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <StatusIcon className={`h-5 w-5 ${getStatusColor(adjustment.status)}`} />
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
                                    Requested by {adjustment.requested_by_name} • Reviewed by {adjustment.reviewed_by_name || 'System'} • {new Date(adjustment.reviewed_at || adjustment.requested_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center text-sm">
                                  <div className="text-gray-600">Previous</div>
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
                                  <div className="font-medium">{adjustment.new_stock}</div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Badge variant={adjustment.status === 'approved' ? 'default' : 'destructive'}>
                                    {adjustment.status.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {adjustment.adjustment_type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredBatches.length === 0 && filteredIndividualAdjustments.length === 0 && (
                <div className="text-center py-12">
                  {historyItems.length === 0 ? (
                    <>
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Adjustment History</h3>
                      <p className="text-gray-600">No stock adjustments have been processed yet.</p>
                    </>
                  ) : (
                    <>
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                      <p className="text-gray-600">Try adjusting your search and filter criteria.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExternalStockAdjustmentHistory;