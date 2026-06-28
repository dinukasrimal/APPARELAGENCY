import { useState, useEffect, useRef } from 'react';
import { sendSMS, SmsTemplates } from '@/services/sms.service';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Invoice } from '@/types/sales';
import { Collection, CustomerInvoiceSummary, InvoiceSummary } from '@/types/collections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, User as UserIcon, FileText, DollarSign, Plus, ArrowLeft, MapPin, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CollectionForm } from './CollectionForm';
import { CollectionDetails } from './CollectionDetails';
import AgencySelector from '@/components/common/AgencySelector';
import { useAgencies } from '@/hooks/useAgency';
import { roundMoney } from '@/utils/money';
import { getDisplayInvoiceNumber } from '@/utils/invoiceNumber';

const COLLECTIONS_CACHE_TTL = 2 * 60 * 1000;
const _collectionsCache: Record<string, { customers: any[]; invoices: any[]; collections: any[]; expiry: number }> = {};

interface CollectionsProps {
  user: User;
}

const Collections = ({ user }: CollectionsProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoiceSummary, setCustomerInvoiceSummary] = useState<CustomerInvoiceSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [viewingCollection, setViewingCollection] = useState<Collection | null>(null);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    user.role === 'superuser' ? null : user.agencyId
  );
  const { toast } = useToast();
  const { agencies } = useAgencies();

  useEffect(() => {
    fetchData();
    // Recompute when agency list is available to hydrate names
    // (collections already cached in component state).
  }, [selectedAgencyId, agencies]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerInvoiceSummary(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const invalidateCollectionsCache = () => {
    const cacheKey = `${user.agencyId}:${selectedAgencyId}`;
    delete _collectionsCache[cacheKey];
  };

  const fetchData = async () => {
    const cacheKey = `${user.agencyId}:${selectedAgencyId}`;
    const cached = _collectionsCache[cacheKey];
    if (cached && Date.now() < cached.expiry) {
      setCustomers(cached.customers);
      setInvoices(cached.invoices);
      setCollections(cached.collections);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.time('[Collections] total load');

      // Build all three queries upfront
      let customersQuery = supabase.from('customers').select('*');
      if (selectedAgencyId) customersQuery = customersQuery.eq('agency_id', selectedAgencyId);

      let invoicesQuery = supabase.from('invoices').select('*');
      if (selectedAgencyId) invoicesQuery = invoicesQuery.eq('agency_id', selectedAgencyId);

      let collectionsQuery = supabase.from('collections').select(`
        *,
        collection_cheques (
          id, cheque_number, bank_name, amount, cheque_date,
          status, cleared_at, return_reason, returned_at, created_at
        ),
        collection_allocations (*)
      `);
      if (selectedAgencyId) collectionsQuery = collectionsQuery.eq('agency_id', selectedAgencyId);

      // Fire all three in parallel
      const [customersResult, invoicesResult, collectionsResult] = await Promise.all([
        customersQuery.order('name'),
        invoicesQuery.order('created_at', { ascending: false }),
        collectionsQuery.order('created_at', { ascending: false }),
      ]);

      if (customersResult.error) throw new Error(`Failed to fetch customers: ${customersResult.error.message}`);
      if (invoicesResult.error) throw new Error(`Failed to fetch invoices: ${invoicesResult.error.message}`);

      const transformedCustomers: Customer[] = (customersResult.data || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        storefrontPhoto: customer.storefront_photo,
        signature: customer.signature,
        gpsCoordinates: { latitude: customer.latitude, longitude: customer.longitude },
        agencyId: customer.agency_id,
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by
      }));

      const transformedInvoices: Invoice[] = (invoicesResult.data || []).map((invoice, index) => {
        const agency = agencies.find((item) => item.id === invoice.agency_id);
        return {
          id: invoice.id,
          invoiceNumber: getDisplayInvoiceNumber(invoice.invoice_number, index + 1, agency?.name, invoice.agency_id),
          salesOrderId: invoice.sales_order_id,
          customerId: invoice.customer_id,
          customerName: invoice.customer_name,
          agencyId: invoice.agency_id,
          agencyName: agency?.name || '',
          items: [],
          subtotal: invoice.subtotal,
          discountAmount: invoice.discount_amount,
          total: invoice.total,
          gpsCoordinates: { latitude: invoice.latitude, longitude: invoice.longitude },
          signature: invoice.signature,
          createdAt: new Date(invoice.created_at),
          createdBy: invoice.created_by
        };
      });

      let transformedCollections: Collection[] = [];
      if (!collectionsResult.error) {
        transformedCollections = (collectionsResult.data || []).map(collection => ({
          id: collection.id,
          customerId: collection.customer_id,
          customerName: collection.customer_name,
          agencyId: collection.agency_id,
          agencyName: agencies.find(a => a.id === collection.agency_id)?.name,
          totalAmount: collection.total_amount,
          paymentMethod: collection.payment_method,
          cashAmount: collection.cash_amount,
          cashDiscount: collection.cash_discount || 0,
          chequeAmount: collection.cheque_amount,
          cashDate: new Date(collection.cash_date),
          chequeDetails: (collection.collection_cheques || []).map(cheque => ({
            id: cheque.id,
            chequeNumber: cheque.cheque_number,
            bankName: cheque.bank_name,
            amount: cheque.amount,
            chequeDate: new Date(cheque.cheque_date),
            status: cheque.status,
            clearedAt: cheque.cleared_at ? new Date(cheque.cleared_at) : undefined,
            returnedAt: cheque.returned_at ? new Date(cheque.returned_at) : undefined,
            returnReason: cheque.return_reason || undefined
          })),
          notes: collection.notes,
          gpsCoordinates: { latitude: collection.latitude, longitude: collection.longitude },
          createdAt: new Date(collection.created_at),
          createdBy: collection.created_by,
          status: collection.status
        }));
      } else {
        console.warn('Collections fetch issue:', collectionsResult.error);
      }

      setCustomers(transformedCustomers);
      setInvoices(transformedInvoices);
      setCollections(transformedCollections);
      console.timeEnd('[Collections] total load');

      _collectionsCache[cacheKey] = {
        customers: transformedCustomers,
        invoices: transformedInvoices,
        collections: transformedCollections,
        expiry: Date.now() + COLLECTIONS_CACHE_TTL,
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch data";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerInvoiceSummary = async (customerId: string) => {
    try {
      // Only include invoices with outstanding > 0 (based on loaded invoice outstandingAmount or fallback)
      const customerInvoices = invoices.filter(inv => inv.customerId === customerId && roundMoney(inv.outstandingAmount ?? inv.total) > 0);
      const customerCollections = collections.filter(col => col.customerId === customerId);

      // Fetch approved/processed returns for this customer
      const { data: returnsData, error: returnsError } = await supabase
        .from('returns')
        .select('id, invoice_id, total, status')
        .eq('customer_id', customerId)
        .in('status', ['approved', 'processed']);

      if (returnsError) {
        console.warn('Returns fetch issue:', returnsError);
      }
      const customerReturns = returnsData || [];

      // Calculate payments with proper date validation
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of day for comparison
      
      let totalCashCollected = 0;
      let totalCashDiscounts = 0;
      let totalRealizedChequePayments = 0; // Only past/current dated cheques
      let totalUnrealizedChequePayments = 0; // Future-dated cheques
      let returnedChequesAmount = 0;
      let returnedChequesCount = 0;

      customerCollections.forEach(collection => {
        totalCashCollected += collection.cashAmount;
        totalCashDiscounts += collection.cashDiscount || 0;
        
        // Process cheques with proper date logic
        collection.chequeDetails?.forEach(cheque => {
          const chequeDate = new Date(cheque.chequeDate);
          chequeDate.setHours(23, 59, 59, 999); // Set to end of cheque date
          
          if (cheque.status === 'returned' || cheque.status === 'held') {
            // Returned cheques add back to outstanding
            returnedChequesAmount += cheque.amount;
            returnedChequesCount++;
          } else if (cheque.status !== 'resolved' && chequeDate <= today) {
            // Only count cheques whose date has arrived as realized payments
            totalRealizedChequePayments += cheque.amount;
          } else if (cheque.status !== 'resolved') {
            // Future-dated cheques are unrealized payments
            totalUnrealizedChequePayments += cheque.amount;
          }
        });
      });

      // Calculate totals
      const totalInvoiced = roundMoney(customerInvoices.reduce((sum, inv) => sum + inv.total, 0));
      const totalReturns = roundMoney(customerReturns.reduce((sum, ret) => sum + (ret.total || 0), 0));
      const totalRealizedPayments = roundMoney(totalCashCollected + totalRealizedChequePayments + totalCashDiscounts);
      
      // Outstanding calculation:
      // Outstanding = Total Invoiced - Realized Payments - Returns + Returned Cheques
      // Future cheques don't count as payments until their date arrives
      const outstandingAmount = roundMoney(totalInvoiced - totalRealizedPayments - totalReturns + returnedChequesAmount);
      
      // Outstanding with Unrealized = Total Invoiced - (Realized + Unrealized) - Returns + Returned Cheques
      const totalAllPayments = roundMoney(totalRealizedPayments + totalUnrealizedChequePayments);
      const outstandingWithUnrealized = roundMoney(totalInvoiced - totalAllPayments - totalReturns + returnedChequesAmount);

      // Batch-fetch all allocations for all invoices at once (avoid N+1)
      console.time('[Collections] customer summary: fetch allocations');
      const invoiceIds = customerInvoices.map(inv => inv.id);
      const allocationsByInvoiceId: Record<string, number> = {};
      if (invoiceIds.length > 0) {
        const { data: allocationsData } = await supabase
          .from('collection_allocations')
          .select('invoice_id, allocated_amount')
          .in('invoice_id', invoiceIds);
        (allocationsData || []).forEach(a => {
          allocationsByInvoiceId[a.invoice_id] = (allocationsByInvoiceId[a.invoice_id] || 0) + a.allocated_amount;
        });
      }

      console.timeEnd('[Collections] customer summary: fetch allocations');
      // Create invoice summaries with proper collection calculations
      const invoiceSummaries: InvoiceSummary[] = customerInvoices.map((invoice) => {
          const collectedAmount = roundMoney(allocationsByInvoiceId[invoice.id] || 0);
          const invoiceReturns = roundMoney(customerReturns
            .filter((ret) => ret.invoice_id === invoice.id)
            .reduce((sum, ret) => sum + (ret.total || 0), 0));
          const outstandingAmount = Math.max(0, roundMoney(invoice.total - collectedAmount - invoiceReturns));

          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            collectedAmount,
            outstandingAmount,
            createdAt: new Date(invoice.createdAt),
            status: outstandingAmount === 0 ? 'paid' :
                    collectedAmount > 0 ? 'partially_paid' : 'pending'
          };
        });

      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerInvoiceSummary({
          customerId,
          customerName: customer.name,
          totalInvoiced,
          totalCollected: totalRealizedPayments,
          unrealizedPayments: totalUnrealizedChequePayments,
          outstandingAmount: outstandingAmount,
          outstandingWithUnrealized: outstandingWithUnrealized,
          outstandingWithCheques: outstandingAmount, // Same as outstanding amount now
          outstandingWithoutCheques: outstandingAmount, // Same as outstanding amount now  
          returnedChequesAmount,
          returnedChequesCount,
          invoices: invoiceSummaries,
          totalReturns
        });
      }
    } catch (error) {
      console.error('Error fetching customer invoice summary:', error);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
  };

  const handleCollectionCreated = (collection: Collection) => {
    invalidateCollectionsCache();
    setCollections(prev => [collection, ...prev]);
    if (selectedCustomer) {
      fetchCustomerInvoiceSummary(selectedCustomer.id);
    }
    setShowCollectionForm(false);
  };

  const handleCollectionFormSubmit = async (formData: any) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      // All payments are now direct payments allocated to specific invoices
      const status = 'allocated';
      const resolvedAgencyId = selectedAgencyId || user.agencyId;

      if (!resolvedAgencyId) {
        toast({
          title: "Missing Agency",
          description: "Please select an agency before recording a collection.",
          variant: "destructive",
        });
        return;
      }
      
      // Create a new collection object with database field names
      const newCollection = {
        customer_id: formData.customerId,
        customer_name: formData.customerName,
        agency_id: resolvedAgencyId,
        total_amount: formData.totalAmount,
        payment_method: formData.paymentMethod,
        cash_amount: formData.cashAmount,
        cash_discount: formData.cashDiscount,
        cheque_amount: formData.chequeAmount,
        cash_date: formData.cashDate.toISOString(),
        notes: formData.notes,
        latitude: formData.gpsCoordinates.latitude,
        longitude: formData.gpsCoordinates.longitude,
        status: status,
        created_by: user.id
      };

      // Save to database
      const { data: savedCollection, error } = await supabase
        .from('collections')
        .insert([newCollection])
        .select()
        .single();

      if (error) {
        console.error('Error saving collection:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to save collection",
          variant: "destructive",
        });
        return;
      }

      // Save cheque details if any
      if (formData.chequeDetails && formData.chequeDetails.length > 0) {
        const chequeDetailsToSave = formData.chequeDetails.map((cheque: any) => ({
          collection_id: savedCollection.id,
          cheque_number: cheque.chequeNumber,
          bank_name: cheque.bankName,
          amount: cheque.amount,
          cheque_date: cheque.chequeDate.toISOString().split('T')[0], // Date only
          status: 'pending' // Default status
        }));

        const { error: chequeError } = await supabase
          .from('collection_cheques')
          .insert(chequeDetailsToSave);

        if (chequeError) {
          console.error('Error saving cheque details:', chequeError);
          toast({
            title: "Warning",
            description: "Collection saved but cheque details failed to save",
            variant: "destructive",
          });
        } else {
          console.log('Cheque details saved successfully');
        }
      }

      // If this is a direct payment, create allocations immediately
      if (formData.paymentType === 'direct' && formData.invoiceAllocations && formData.invoiceAllocations.length > 0) {
        const allocations = formData.invoiceAllocations.map((allocation: any) => ({
          collection_id: savedCollection.id,
          invoice_id: allocation.invoiceId,
          allocated_amount: allocation.amount,
          allocated_by: user.id,
          allocated_at: new Date().toISOString()
        }));

        const { error: allocationError } = await supabase
          .from('collection_allocations')
          .insert(allocations);

        if (allocationError) {
          console.error('Error saving allocations:', allocationError);
          // Don't fail the entire operation, but log the error
          toast({
            title: "Warning",
            description: "Collection saved but allocation failed. You can allocate manually.",
            variant: "destructive",
          });
        }
      }

      // Transform the saved data to match Collection type
      const transformedCollection: Collection = {
        id: savedCollection.id,
        customerId: savedCollection.customer_id,
        customerName: savedCollection.customer_name,
        agencyId: savedCollection.agency_id,
        agencyName: agencies.find(a => a.id === savedCollection.agency_id)?.name,
        totalAmount: savedCollection.total_amount,
        paymentMethod: savedCollection.payment_method,
        cashAmount: savedCollection.cash_amount,
        cashDiscount: savedCollection.cash_discount || 0,
        chequeAmount: savedCollection.cheque_amount,
        cashDate: new Date(savedCollection.cash_date),
        chequeDetails: (formData.chequeDetails || []).map((cheque: any) => ({
          id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID for display
          chequeNumber: cheque.chequeNumber,
          bankName: cheque.bankName,
          amount: cheque.amount,
          chequeDate: new Date(cheque.chequeDate),
          status: 'pending'
        })),
        notes: savedCollection.notes,
        gpsCoordinates: {
          latitude: savedCollection.latitude,
          longitude: savedCollection.longitude
        },
        createdAt: new Date(savedCollection.created_at),
        createdBy: savedCollection.created_by,
        status: savedCollection.status
      };

      handleCollectionCreated(transformedCollection);

      sendSMS(
        selectedCustomer?.phone,
        SmsTemplates.collectionRecorded(
          selectedCustomer?.name ?? formData.customerName,
          Number(formData.cashAmount) || 0,
          (formData.chequeDetails || []).map((c: any) => ({
            chequeNumber: c.chequeNumber,
            amount: Number(c.amount) || 0,
          })),
        ),
      );

      const chequeCount = formData.chequeDetails?.length || 0;
      const successMessage = chequeCount > 0
        ? `Payment recorded with ${chequeCount} cheque${chequeCount > 1 ? 's' : ''} and allocated to invoices successfully`
        : "Payment recorded and allocated to invoices successfully";

      toast({
        title: "Success",
        description: successMessage,
      });
    } catch (error) {
      console.error('Error handling collection submission:', error);
      toast({
        title: "Error",
        description: "Failed to record collection",
        variant: "destructive",
      });
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };


  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showCollectionForm && selectedCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowCollectionForm(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Collections
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Record Collection</h2>
            <p className="text-gray-600">Record payment collection for {selectedCustomer.name}</p>
          </div>
        </div>
        
        <CollectionForm
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          customerInvoices={customerInvoiceSummary?.invoices || []}
          onSubmit={handleCollectionFormSubmit}
          onCancel={() => setShowCollectionForm(false)}
          loading={isSubmitting}
        />
      </div>
    );
  }


  if (viewingCollection) {
    return (
      <CollectionDetails
        collection={viewingCollection}
        onBack={() => setViewingCollection(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Collections</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage customer payments and collections</p>
        </div>
      </div>

      {/* Agency Selector for Superusers */}
      <AgencySelector
        user={user}
        selectedAgencyId={selectedAgencyId}
        onAgencyChange={(agencyId) => {
          setSelectedAgencyId(agencyId);
          setSelectedCustomer(null);
          setCustomerInvoiceSummary(null);
          setSearchTerm('');
        }}
        placeholder="Select agency to view collections..."
      />

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Select Customer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchTerm && (
            <div className="space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No customers found matching "{searchTerm}"
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <Button
                      key={customer.id}
                      variant={selectedCustomer?.id === customer.id ? "default" : "outline"}
                      className="w-full justify-start h-auto p-4"
                      onClick={() => handleCustomerSelect(customer.id)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.phone}</div>
                      </div>
                    </Button>
                  ))}
                  {filteredCustomers.length > 5 && (
                    <div className="text-center py-2 text-sm text-gray-500">
                      Showing first 5 results. Type more to narrow search.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!searchTerm && (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Start typing to search for customers</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Invoice Summary */}
      {selectedCustomer && customerInvoiceSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedCustomer.name} - Invoice Summary
              </span>
              <Button
                onClick={() => setShowCollectionForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Record Collection
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">
                  LKR {customerInvoiceSummary.totalInvoiced.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Invoiced</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  LKR {customerInvoiceSummary.totalCollected.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Realized Payments</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">
                  LKR {customerInvoiceSummary.unrealizedPayments.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Unrealized Payments</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  LKR {customerInvoiceSummary.outstandingAmount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Outstanding Amount</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-xl font-bold text-orange-600">
                  LKR {customerInvoiceSummary.outstandingWithUnrealized.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Outstanding with Unrealized</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {customerInvoiceSummary.returnedChequesCount} ({customerInvoiceSummary.returnedChequesAmount > 0 ? `LKR ${customerInvoiceSummary.returnedChequesAmount.toLocaleString()}` : 'LKR 0'})
                </div>
                <div className="text-sm text-gray-600">Returned Cheques</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-xl font-bold text-emerald-600">
                  LKR {(customerInvoiceSummary.totalReturns || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Approved Returns</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Invoices</h4>
              {customerInvoiceSummary.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">Invoice #{invoice.invoiceNumber}</div>
                    <div className="text-sm text-gray-500">
                      {invoice.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">LKR {invoice.total.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">
                      Outstanding: LKR {invoice.outstandingAmount.toLocaleString()}
                    </div>
                  </div>
                  <Badge
                    variant={
                      invoice.status === 'paid' ? 'default' :
                      invoice.status === 'partially_paid' ? 'secondary' : 'destructive'
                    }
                  >
                    {invoice.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Collections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collections.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Collections</h3>
              <p className="text-gray-600">No collections have been recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {collections.slice(0, 5).map((collection) => (
                <div key={collection.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium">{collection.customerName}</div>
                        <div className="text-sm text-gray-500">
                          {collection.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        LKR {collection.totalAmount.toLocaleString()}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{collection.paymentMethod}</Badge>
                        <Badge variant="default">
                          allocated
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingCollection(collection)}
                    className="ml-2"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Collections; 
