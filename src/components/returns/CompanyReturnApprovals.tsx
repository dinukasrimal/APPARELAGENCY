
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CompanyReturn {
  id: string;
  agency_name: string;
  total: number;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  items: Array<{
    id: string;
    product_name: string;
    quantity_returned: number;
    unit_price: number;
    total: number;
    reason: string;
  }>;
}

interface CompanyReturnApprovalsProps {
  user: User;
}

const CompanyReturnApprovals = ({ user }: CompanyReturnApprovalsProps) => {
  const { toast } = useToast();
  const [returns, setReturns] = useState<CompanyReturn[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<CompanyReturn | null>(null);
  const [loading, setLoading] = useState(true);

  // Only superusers can access this component
  if (user.role !== 'superuser') {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only superusers can access company return approvals.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchCompanyReturns();
  }, []);

  const fetchCompanyReturns = async () => {
    try {
      setLoading(true);
      
      // Fetch returns with agency information
      const { data: returnsData, error: returnsError } = await supabase
        .from('returns')
        .select(`
          id,
          total,
          created_at,
          status,
          agency_id,
          agencies!inner(name)
        `)
        .order('created_at', { ascending: false });

      if (returnsError) throw returnsError;

      // Fetch return items for each return
      const returnsWithItems = await Promise.all(
        (returnsData || []).map(async (returnItem) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('return_items')
            .select(`
              id,
              product_name,
              quantity_returned,
              unit_price,
              total,
              reason
            `)
            .eq('return_id', returnItem.id);

          if (itemsError) throw itemsError;

          return {
            id: returnItem.id,
            agency_name: (returnItem.agencies as any).name,
            total: returnItem.total,
            created_at: returnItem.created_at,
            status: returnItem.status,
            items: itemsData || []
          };
        })
      );

      setReturns(returnsWithItems);
    } catch (error) {
      console.error('Error fetching company returns:', error);
      toast({
        title: "Error",
        description: "Failed to fetch company returns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (returnId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('returns')
        .update({
          status: approve ? 'approved' : 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user.id
        })
        .eq('id', returnId);

      if (error) throw error;

      toast({
        title: approve ? "Return Approved" : "Return Rejected",
        description: `Company return has been ${approve ? 'approved' : 'rejected'} successfully.`
      });

      // Refresh the data
      fetchCompanyReturns();
      setSelectedReturn(null);
    } catch (error) {
      console.error('Error updating return status:', error);
      toast({
        title: "Error",
        description: "Failed to update return status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const },
      processed: { label: 'Processed', variant: 'outline' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (selectedReturn) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setSelectedReturn(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
          <h2 className="text-2xl font-bold">Company Return Details</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Return from {selectedReturn.agency_name}</span>
              {getStatusBadge(selectedReturn.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Return Date</p>
                <p className="font-medium">{new Date(selectedReturn.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="font-medium text-lg">LKR {selectedReturn.total.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Return Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReturn.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity_returned}</TableCell>
                      <TableCell>LKR {item.unit_price.toLocaleString()}</TableCell>
                      <TableCell>LKR {item.total.toLocaleString()}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedReturn.status === 'pending' && (
              <div className="flex gap-4 pt-4">
                <Button 
                  onClick={() => handleApproval(selectedReturn.id, true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Return
                </Button>
                <Button 
                  onClick={() => handleApproval(selectedReturn.id, false)}
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Return
                </Button>
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
        <h2 className="text-2xl font-bold text-gray-900">Company Return Approvals</h2>
        <p className="text-gray-600">Review and approve company returns from agencies</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Company Returns</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading returns...</div>
          ) : returns.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No company returns to review</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency Name</TableHead>
                  <TableHead>Total Return Value</TableHead>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((returnItem) => (
                  <TableRow key={returnItem.id}>
                    <TableCell className="font-medium">{returnItem.agency_name}</TableCell>
                    <TableCell>LKR {returnItem.total.toLocaleString()}</TableCell>
                    <TableCell>{new Date(returnItem.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedReturn(returnItem)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyReturnApprovals;
