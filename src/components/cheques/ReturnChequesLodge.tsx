import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, FileX, AlertTriangle, Banknote, CheckCircle2, Landmark, Pause, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AgencySelector from '@/components/common/AgencySelector';

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
  returnReason?: string;
  returnedAt?: Date;
  resolutionMethod?: string;
  resolvedAt?: Date;
}

const ReturnChequesLodge = ({ user, onBack }: ReturnChequesLodgeProps) => {
  const [cheques, setCheques] = useState<ChequeInfo[]>([]);
  const [returnedCheques, setReturnedCheques] = useState<ChequeInfo[]>([]);
  const [filteredCheques, setFilteredCheques] = useState<ChequeInfo[]>([]);
  const [returnedFilter, setReturnedFilter] = useState<'returned' | 'cleared'>('returned');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCheque, setSelectedCheque] = useState<ChequeInfo | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [recoveryCheque, setRecoveryCheque] = useState<ChequeInfo | null>(null);
  const [replacementCheque, setReplacementCheque] = useState({
    chequeNumber: '',
    bankName: '',
    amount: 0,
    chequeDate: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    user.role === 'superuser' ? null : user.agencyId
  );
  const { toast } = useToast();

  const getLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getChequeDate = (dateValue: string) => new Date(`${dateValue}T00:00:00`);

  const getAutoStatus = (status: string | null | undefined, chequeDateKey: string) => {
    if (status === 'pending' && chequeDateKey <= getLocalDateKey(new Date())) return 'cleared';
    return status || 'pending';
  };

  const updateCheque = async (
    cheque: ChequeInfo,
    values: Record<string, string | null>
  ) => {
    const { error } = await supabase
      .from('collection_cheques')
      .update(values)
      .eq('id', cheque.id);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to update cheque: ${error.message}`,
        variant: "destructive",
      });
      return false;
    }

    await fetchCheques();
    return true;
  };

  useEffect(() => {
    fetchCheques();
  }, [selectedAgencyId]);

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
            status,
            return_reason,
            returned_at,
            resolution_method,
            resolved_at
          )
        `)
        .not('collection_cheques', 'is', null);

      // Filter by agency
      if (selectedAgencyId) {
        collectionsQuery = collectionsQuery.eq('agency_id', selectedAgencyId);
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

      const duePendingChequeIds: string[] = [];

      // Transform the data into flat cheque list
      const outstandingChequesList: ChequeInfo[] = [];
      const returnedChequesList: ChequeInfo[] = [];
      
      collections?.forEach(collection => {
        collection.collection_cheques?.forEach(cheque => {
          const chequeDateKey = cheque.cheque_date;
          const storedStatus = cheque.status || 'pending';
          const effectiveStatus = getAutoStatus(storedStatus, chequeDateKey);

          if (storedStatus === 'pending' && effectiveStatus === 'cleared') {
            duePendingChequeIds.push(cheque.id);
          }

          const chequeInfo = {
            id: cheque.id,
            chequeNumber: cheque.cheque_number,
            bankName: cheque.bank_name,
            amount: cheque.amount,
            chequeDate: getChequeDate(chequeDateKey),
            customerName: collection.customer_name,
            customerId: collection.customer_id,
            collectionId: collection.id,
            status: effectiveStatus,
            returnReason: cheque.return_reason || undefined,
            returnedAt: cheque.returned_at ? new Date(cheque.returned_at) : undefined,
            resolutionMethod: cheque.resolution_method || undefined,
            resolvedAt: cheque.resolved_at ? new Date(cheque.resolved_at) : undefined,
          };

          if (cheque.returned_at || cheque.return_reason || ['returned', 'resolved'].includes(storedStatus)) {
            returnedChequesList.push(chequeInfo);
          }

          if (!cheque.returned_at && !cheque.return_reason && storedStatus !== 'resolved') {
            outstandingChequesList.push(chequeInfo);
          }
        });
      });

      if (duePendingChequeIds.length > 0) {
        const { error: clearError } = await supabase
          .from('collection_cheques')
          .update({
            status: 'cleared',
            cleared_at: new Date().toISOString(),
          })
          .in('id', duePendingChequeIds);

        if (clearError) {
          console.warn('Failed to auto-clear due cheques:', clearError);
        }
      }

      setCheques(outstandingChequesList);
      setReturnedCheques(
        returnedChequesList.sort((a, b) => (b.returnedAt?.getTime() || 0) - (a.returnedAt?.getTime() || 0))
      );
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
          description: `Failed to mark cheque as returned: ${error.message}`,
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
      await fetchCheques();

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

  const handleClearWithMoney = async (cheque: ChequeInfo) => {
    const success = await updateCheque(cheque, {
      status: 'cleared',
      cleared_at: new Date().toISOString(),
      resolution_method: 'cash',
      resolved_at: new Date().toISOString(),
    });

    if (success) {
      toast({
        title: "Cheque Cleared",
        description: `Cheque ${cheque.chequeNumber} was cleared with money.`,
      });
    }
  };

  const handleHoldCheque = async (cheque: ChequeInfo) => {
    const success = await updateCheque(cheque, {
      status: 'held',
      resolution_method: 'hold',
      cleared_at: null,
      resolved_at: null,
    });

    if (success) {
      toast({
        title: "Cheque Held",
        description: `Cheque ${cheque.chequeNumber} will remain outstanding until manually passed.`,
      });
    }
  };

  const handleManualPass = async (cheque: ChequeInfo) => {
    const success = await updateCheque(cheque, {
      status: 'cleared',
      cleared_at: new Date().toISOString(),
      resolution_method: 'manual_pass',
      resolved_at: new Date().toISOString(),
    });

    if (success) {
      toast({
        title: "Cheque Passed",
        description: `Cheque ${cheque.chequeNumber} was manually passed.`,
      });
    }
  };

  const handleHoldOutstandingCheque = async (cheque: ChequeInfo) => {
    const success = await updateCheque(cheque, {
      status: 'held',
      cleared_at: null,
      resolution_method: 'hold',
      resolved_at: null,
    });

    if (success) {
      toast({
        title: "Cheque Held",
        description: `Cheque ${cheque.chequeNumber} will not clear until you unhold it.`,
      });
    }
  };

  const handleUnholdOutstandingCheque = async (cheque: ChequeInfo) => {
    const chequeDateKey = getLocalDateKey(cheque.chequeDate);
    const isDue = chequeDateKey <= getLocalDateKey(new Date());
    const success = await updateCheque(cheque, {
      status: isDue ? 'cleared' : 'pending',
      cleared_at: isDue ? new Date().toISOString() : null,
      resolution_method: null,
      resolved_at: null,
    });

    if (success) {
      toast({
        title: "Cheque Unheld",
        description: `Cheque ${cheque.chequeNumber} is now ${isDue ? 'cleared' : 'pending'}.`,
      });
    }
  };

  const openReplacementChequeForm = (cheque: ChequeInfo) => {
    setRecoveryCheque(cheque);
    setReplacementCheque({
      chequeNumber: '',
      bankName: '',
      amount: cheque.amount,
      chequeDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleClearWithReplacementCheque = async () => {
    if (!recoveryCheque) return;
    if (!replacementCheque.chequeNumber.trim() || !replacementCheque.bankName.trim() || replacementCheque.amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Enter cheque number, bank name, amount, and cheque date.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('collection_cheques')
        .insert({
          collection_id: recoveryCheque.collectionId,
          cheque_number: replacementCheque.chequeNumber,
          bank_name: replacementCheque.bankName,
          amount: replacementCheque.amount,
          cheque_date: replacementCheque.chequeDate,
          status: 'pending',
          replacement_for_cheque_id: recoveryCheque.id,
        });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('collection_cheques')
        .update({
          status: 'resolved',
          resolution_method: 'replacement_cheque',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', recoveryCheque.id);

      if (updateError) throw updateError;

      toast({
        title: "Replacement Cheque Added",
        description: `Cheque ${recoveryCheque.chequeNumber} was cleared with a replacement cheque.`,
      });

      setRecoveryCheque(null);
      setReplacementCheque({
        chequeNumber: '',
        bankName: '',
        amount: 0,
        chequeDate: new Date().toISOString().split('T')[0],
      });
      await fetchCheques();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add replacement cheque';
      toast({
        title: "Error",
        description: message,
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

  const filteredReturnedCheques = returnedCheques.filter(c =>
    returnedFilter === 'cleared'
      ? c.status === 'resolved' || c.status === 'cleared'
      : c.status === 'returned' || c.status === 'held'
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Return Cheques Lodge</h2>
          <p className="text-sm text-gray-600 mt-0.5">Mark cheques as returned and manage bounced payments</p>
        </div>
      </div>

      {/* Agency Selector for Superusers */}
      <AgencySelector
        user={user}
        selectedAgencyId={selectedAgencyId}
        onAgencyChange={(agencyId) => {
          setSelectedAgencyId(agencyId);
          setSelectedCheque(null);
          setSearchTerm('');
        }}
        placeholder="Select agency to view cheques..."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="space-y-2 max-h-[50vh] md:max-h-96 overflow-y-auto">
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
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">Cheque #{cheque.chequeNumber}</div>
                        <div className="text-sm text-gray-600 truncate">
                          {cheque.customerName} • {cheque.bankName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {cheque.chequeDate.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="font-bold text-green-600 text-sm">
                          LKR {cheque.amount.toLocaleString()}
                        </div>
                        <Badge variant={cheque.status === 'cleared' ? 'default' : cheque.status === 'held' ? 'destructive' : 'secondary'}>
                          {cheque.status}
                        </Badge>
                        {cheque.status === 'held' ? (
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                            onClick={(e) => { e.stopPropagation(); handleUnholdOutstandingCheque(cheque); }}>
                            <Play className="h-3 w-3 mr-1" />Unhold
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                            onClick={(e) => { e.stopPropagation(); handleHoldOutstandingCheque(cheque); }}>
                            <Pause className="h-3 w-3 mr-1" />Hold
                          </Button>
                        )}
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
            <div className="grid grid-cols-3 gap-3 md:gap-4">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Returned Cheque Details</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={returnedFilter === 'returned' ? 'default' : 'outline'}
                onClick={() => setReturnedFilter('returned')}
                className="flex-1 sm:flex-none"
              >
                Returned
                {returnedCheques.filter(c => c.status === 'returned' || c.status === 'held').length > 0 && (
                  <span className="ml-1.5 bg-white/20 text-xs rounded-full px-1.5">
                    {returnedCheques.filter(c => c.status === 'returned' || c.status === 'held').length}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant={returnedFilter === 'cleared' ? 'default' : 'outline'}
                onClick={() => setReturnedFilter('cleared')}
                className="flex-1 sm:flex-none"
              >
                Cleared
                {returnedCheques.filter(c => c.status === 'resolved' || c.status === 'cleared').length > 0 && (
                  <span className="ml-1.5 bg-white/20 text-xs rounded-full px-1.5">
                    {returnedCheques.filter(c => c.status === 'resolved' || c.status === 'cleared').length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {recoveryCheque && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
              <div>
                <h4 className="font-medium text-blue-950">Replacement Cheque</h4>
                <p className="text-sm text-blue-700">
                  Clearing cheque {recoveryCheque.chequeNumber} with a new cheque. The replacement stays open until its cheque date.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="replacementChequeNumber">Cheque Number</Label>
                  <Input
                    id="replacementChequeNumber"
                    value={replacementCheque.chequeNumber}
                    onChange={(event) => setReplacementCheque((current) => ({ ...current, chequeNumber: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="replacementBank">Bank Name</Label>
                  <Input
                    id="replacementBank"
                    value={replacementCheque.bankName}
                    onChange={(event) => setReplacementCheque((current) => ({ ...current, bankName: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="replacementAmount">Amount</Label>
                  <Input
                    id="replacementAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={replacementCheque.amount}
                    onChange={(event) => setReplacementCheque((current) => ({ ...current, amount: parseFloat(event.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="replacementDate">Cheque Date</Label>
                  <Input
                    id="replacementDate"
                    type="date"
                    value={replacementCheque.chequeDate}
                    onChange={(event) => setReplacementCheque((current) => ({ ...current, chequeDate: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRecoveryCheque(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleClearWithReplacementCheque} disabled={submitting}>
                  <Landmark className="h-4 w-4 mr-2" />
                  Add Replacement Cheque
                </Button>
              </div>
            </div>
          )}

          {filteredReturnedCheques.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {returnedFilter === 'cleared'
                ? 'No cleared cheques found.'
                : 'No returned cheques found for the selected agency.'}
            </div>
          ) : (
            <>
              {/* Card layout — shown on mobile/tablet (< lg) */}
              <div className="space-y-3 lg:hidden">
                {filteredReturnedCheques.map((cheque) => (
                  <div key={cheque.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">Cheque #{cheque.chequeNumber}</div>
                        <div className="text-sm text-gray-600 truncate">{cheque.customerName}</div>
                        <div className="text-sm text-gray-500">{cheque.bankName}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-red-600">LKR {cheque.amount.toLocaleString()}</div>
                        <Badge variant={cheque.status === 'held' ? 'secondary' : cheque.status === 'resolved' ? 'default' : 'destructive'} className="mt-1">
                          {cheque.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <div><span className="font-medium">Cheque Date:</span> {cheque.chequeDate.toLocaleDateString()}</div>
                      <div><span className="font-medium">Returned:</span> {cheque.returnedAt ? cheque.returnedAt.toLocaleDateString() : '-'}</div>
                      {cheque.returnReason && (
                        <div className="col-span-2"><span className="font-medium">Reason:</span> {cheque.returnReason}</div>
                      )}
                    </div>
                    {returnedFilter === 'returned' && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t">
                        {cheque.status === 'held' ? (
                          <Button size="sm" variant="outline" onClick={() => handleManualPass(cheque)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />Pass
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleClearWithMoney(cheque)}>
                              <Banknote className="h-4 w-4 mr-1" />Money
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openReplacementChequeForm(cheque)}>
                              <Landmark className="h-4 w-4 mr-1" />Cheque
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleHoldCheque(cheque)}>
                              <Pause className="h-4 w-4 mr-1" />Hold
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Table layout — shown on desktop (lg+) */}
              <div className="hidden lg:block overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Cheque #</th>
                      <th className="px-3 py-2 text-left font-medium">Customer</th>
                      <th className="px-3 py-2 text-left font-medium">Bank</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Cheque Date</th>
                      <th className="px-3 py-2 text-left font-medium">Returned Date</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Reason</th>
                      {returnedFilter === 'returned' && (
                        <th className="px-3 py-2 text-right font-medium">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturnedCheques.map((cheque) => (
                      <tr key={cheque.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-gray-900">{cheque.chequeNumber}</td>
                        <td className="px-3 py-2 text-gray-700">{cheque.customerName}</td>
                        <td className="px-3 py-2 text-gray-700">{cheque.bankName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600">
                          LKR {cheque.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{cheque.chequeDate.toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {cheque.returnedAt ? cheque.returnedAt.toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={cheque.status === 'held' ? 'secondary' : cheque.status === 'resolved' ? 'default' : 'destructive'}>
                            {cheque.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{cheque.returnReason || '-'}</td>
                        {returnedFilter === 'returned' && (
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              {cheque.status === 'held' ? (
                                <Button size="sm" variant="outline" onClick={() => handleManualPass(cheque)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />Pass
                                </Button>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleClearWithMoney(cheque)}>
                                    <Banknote className="h-4 w-4 mr-1" />Money
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openReplacementChequeForm(cheque)}>
                                    <Landmark className="h-4 w-4 mr-1" />Cheque
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleHoldCheque(cheque)}>
                                    <Pause className="h-4 w-4 mr-1" />Hold
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnChequesLodge;
