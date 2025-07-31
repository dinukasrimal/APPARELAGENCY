import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, FileX, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReturnChequesLodgeProps {
  user: User;
  onBack: () => void;
}

interface ChequeInfo {
  id: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  chequeDate: Date;
  customerName: string;
  customerId: string;
  collectionId: string;
  status: string;
}

const ReturnChequesLodge = ({ user, onBack }: ReturnChequesLodgeProps) => {
  const [cheques, setCheques] = useState<ChequeInfo[]>([]);
  const [filteredCheques, setFilteredCheques] = useState<ChequeInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCheque, setSelectedCheque] = useState<ChequeInfo | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCheques();
  }, []);

  useEffect(() => {
    const filtered = cheques.filter(cheque => 
      cheque.chequeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cheque.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cheque.bankName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCheques(filtered);
  }, [searchTerm, cheques]);

  const fetchCheques = async () => {
    try {
      setLoading(true);
      
      // First get collections with cheques for the agency
      let collectionsQuery = supabase
        .from('collections')
        .select(`
          id,
          customer_id,
          customer_name,
          collection_cheques (
            id,
            cheque_number,
            bank_name,
            amount,
            cheque_date,
            status
          )
        `)
        .not('collection_cheques', 'is', null);

      // Filter by agency for non-superusers
      if (user.role !== 'superuser' && user.agencyId) {
        collectionsQuery = collectionsQuery.eq('agency_id', user.agencyId);
      }

      const { data: collections, error } = await collectionsQuery;

      if (error) {
        console.error('Error fetching cheques:', error);
        toast({
          title: "Error",
          description: "Failed to fetch cheques",
          variant: "destructive",
        });
        return;
      }

      // Transform the data into flat cheque list
      const chequesList: ChequeInfo[] = [];
      
      collections?.forEach(collection => {
        collection.collection_cheques?.forEach(cheque => {
          // Only include cheques that are not already returned
          if (cheque.status !== 'returned') {
            chequesList.push({
              id: cheque.id,
              chequeNumber: cheque.cheque_number,
              bankName: cheque.bank_name,
              amount: cheque.amount,
              chequeDate: new Date(cheque.cheque_date),
              customerName: collection.customer_name,
              customerId: collection.customer_id,
              collectionId: collection.id,
              status: cheque.status
            });
          }
        });
      });

      setCheques(chequesList);
    } catch (error) {
      console.error('Error fetching cheques:', error);
      toast({
        title: "Error",
        description: "Failed to fetch cheques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReturnCheque = async () => {
    if (!selectedCheque || !returnReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select a cheque and provide a return reason",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Update the cheque status to 'returned'
      const { error } = await supabase
        .from('collection_cheques')
        .update({
          status: 'returned',
          return_reason: returnReason,
          returned_at: new Date(returnDate).toISOString()
        })
        .eq('id', selectedCheque.id);

      if (error) {
        console.error('Error returning cheque:', error);
        toast({
          title: "Error",
          description: "Failed to mark cheque as returned",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Cheque ${selectedCheque.chequeNumber} has been marked as returned`,
      });

      // Reset form and refresh data
      setSelectedCheque(null);
      setReturnReason('');
      setReturnDate(new Date().toISOString().split('T')[0]);
      fetchCheques();

    } catch (error) {
      console.error('Error returning cheque:', error);
      toast({
        title: "Error",
        description: "Failed to process cheque return",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Return Cheques Lodge</h2>
          <p className="text-gray-600">Mark cheques as returned and manage bounced payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cheque Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileX className="h-5 w-5" />
              Select Cheque to Return
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search cheques by number, customer, or bank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Cheques List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCheques.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? `No cheques found matching "${searchTerm}"` : 'No outstanding cheques found'}
                </div>
              ) : (
                filteredCheques.map((cheque) => (
                  <div
                    key={cheque.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCheque?.id === cheque.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedCheque(cheque)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium">Cheque #{cheque.chequeNumber}</div>
                        <div className="text-sm text-gray-600">
                          {cheque.customerName} • {cheque.bankName}
                        </div>
                        <div className="text-sm text-gray-500">
                          Date: {cheque.chequeDate.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          LKR {cheque.amount.toLocaleString()}
                        </div>
                        <Badge variant={cheque.status === 'cleared' ? 'default' : 'secondary'}>
                          {cheque.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Return Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Return Cheque Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCheque ? (
              <>
                {/* Selected Cheque Info */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Selected Cheque</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Cheque Number:</strong> {selectedCheque.chequeNumber}</div>
                    <div><strong>Customer:</strong> {selectedCheque.customerName}</div>
                    <div><strong>Bank:</strong> {selectedCheque.bankName}</div>
                    <div><strong>Amount:</strong> LKR {selectedCheque.amount.toLocaleString()}</div>
                    <div><strong>Cheque Date:</strong> {selectedCheque.chequeDate.toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Return Details */}
                <div>
                  <Label htmlFor="returnDate">Return Date</Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="returnReason">Return Reason *</Label>
                  <Textarea
                    id="returnReason"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Enter reason for cheque return (e.g., Insufficient funds, Account closed, etc.)"
                    rows={3}
                    required
                  />
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleReturnCheque}
                    disabled={submitting || !returnReason.trim()}
                    className="w-full"
                    variant="destructive"
                  >
                    {submitting ? 'Processing...' : 'Mark Cheque as Returned'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a cheque from the list to mark it as returned</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      {cheques.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Cheques Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{cheques.length}</div>
                <div className="text-sm text-gray-600">Total Outstanding Cheques</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  LKR {cheques.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Amount</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {cheques.filter(c => new Date(c.chequeDate) > new Date()).length}
                </div>
                <div className="text-sm text-gray-600">Future Dated Cheques</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReturnChequesLodge;