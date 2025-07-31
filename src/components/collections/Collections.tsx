import { useState, useEffect } from 'react';
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
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [viewingCollection, setViewingCollection] = useState<Collection | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerInvoiceSummary(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch customers for the agency
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('agency_id', user.agencyId)
        .order('name');

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        throw new Error(`Failed to fetch customers: ${customersError.message}`);
      }

      // Transform customers data
      const transformedCustomers: Customer[] = (customersData || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        storefrontPhoto: customer.storefront_photo,
        signature: customer.signature,
        gpsCoordinates: {
          latitude: customer.latitude,
          longitude: customer.longitude
        },
        agencyId: customer.agency_id,
        createdAt: new Date(customer.created_at),
        createdBy: customer.created_by
      }));

      // Fetch invoices for the agency
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('agency_id', user.agencyId)
        .order('created_at', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        throw new Error(`Failed to fetch invoices: ${invoicesError.message}`);
      }

      // Transform invoices data
      const transformedInvoices: Invoice[] = (invoicesData || []).map(invoice => ({
        id: invoice.id,
        salesOrderId: invoice.sales_order_id,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        agencyId: invoice.agency_id,
        items: [], // We'll need to fetch items separately if needed
        subtotal: invoice.subtotal,
        discountAmount: invoice.discount_amount,
        total: invoice.total,
        gpsCoordinates: {
          latitude: invoice.latitude,
          longitude: invoice.longitude
        },
        signature: invoice.signature,
        createdAt: new Date(invoice.created_at),
        createdBy: invoice.created_by
      }));

      // Fetch collections for the agency
      let transformedCollections: Collection[] = [];
      try {
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('collections')
          .select(`
            *,
            collection_cheques (*),
            collection_allocations (*)
          `)
          .eq('agency_id', user.agencyId)
          .order('created_at', { ascending: false });

        if (collectionsError) {
          console.warn('Collections table might not exist yet:', collectionsError);
          // Don't throw error, just use empty collections
        } else {
          // Transform collections data
          transformedCollections = (collectionsData || []).map(collection => ({
            id: collection.id,
            customerId: collection.customer_id,
            customerName: collection.customer_name,
            agencyId: collection.agency_id,
            totalAmount: collection.total_amount,
            paymentMethod: collection.payment_method,
            cashAmount: collection.cash_amount,
            chequeAmount: collection.cheque_amount,
            cashDate: new Date(collection.cash_date),
            chequeDetails: (collection.collection_cheques || []).map(cheque => ({
              id: cheque.id,
              chequeNumber: cheque.cheque_number,
              bankName: cheque.bank_name,
              amount: cheque.amount,
              chequeDate: new Date(cheque.cheque_date),
              status: cheque.status,
              clearedAt: cheque.cleared_at ? new Date(cheque.cleared_at) : undefined
            })),
            notes: collection.notes,
            gpsCoordinates: {
              latitude: collection.latitude,
              longitude: collection.longitude
            },
            createdAt: new Date(collection.created_at),
            createdBy: collection.created_by,
            status: collection.status
          }));
        }
      } catch (collectionsError) {
        console.warn('Collections table not found, using empty collections:', collectionsError);
        // Continue with empty collections
      }

      setCustomers(transformedCustomers);
      setInvoices(transformedInvoices);
      setCollections(transformedCollections);
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
      const customerInvoices = invoices.filter(inv => inv.customerId === customerId);
      const customerCollections = collections.filter(col => col.customerId === customerId);

      // Calculate cheque payments with date validation
      const today = new Date();
      let totalCashCollected = 0;
      let totalChequeCollected = 0;
      let totalValidChequeCollected = 0; // Only cheques with past dates
      let returnedChequesAmount = 0;
      let returnedChequesCount = 0;

      customerCollections.forEach(collection => {
        totalCashCollected += collection.cashAmount;
        
        // Process cheques
        collection.chequeDetails?.forEach(cheque => {
          if (cheque.status === 'returned') {
            returnedChequesAmount += cheque.amount;
            returnedChequesCount++;
          } else {
            totalChequeCollected += cheque.amount;
            
            // Only count as valid payment if cheque date has passed
            if (new Date(cheque.chequeDate) <= today) {
              totalValidChequeCollected += cheque.amount;
            }
          }
        });
      });

      // Calculate totals
      const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalCollectedWithAllCheques = totalCashCollected + totalChequeCollected;
      const totalCollectedWithValidCheques = totalCashCollected + totalValidChequeCollected;
      const outstandingWithAllCheques = totalInvoiced - totalCollectedWithAllCheques + returnedChequesAmount;
      const outstandingWithoutFutureCheques = totalInvoiced - totalCollectedWithValidCheques + returnedChequesAmount;

      // Create invoice summaries with proper collection calculations
      const invoiceSummaries: InvoiceSummary[] = await Promise.all(
        customerInvoices.map(async (invoice) => {
          // Get allocations for this invoice
          const { data: allocations, error } = await supabase
            .from('collection_allocations')
            .select('allocated_amount')
            .eq('invoice_id', invoice.id);

          if (error) {
            console.error('Error fetching allocations for invoice:', invoice.id, error);
          }

          const collectedAmount = (allocations || []).reduce((sum, allocation) => sum + allocation.allocated_amount, 0);
          const outstandingAmount = invoice.total - collectedAmount;
          
          return {
            id: invoice.id,
            invoiceNumber: invoice.id, // Using ID as invoice number for now
            total: invoice.total,
            collectedAmount,
            outstandingAmount,
            createdAt: new Date(invoice.createdAt),
            status: outstandingAmount === 0 ? 'paid' : 
                    collectedAmount > 0 ? 'partially_paid' : 'pending'
          };
        })
      );

      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerInvoiceSummary({
          customerId,
          customerName: customer.name,
          totalInvoiced,
          totalCollected: totalCollectedWithValidCheques,
          outstandingAmount: outstandingWithoutFutureCheques,
          outstandingWithCheques: outstandingWithAllCheques,
          outstandingWithoutCheques: outstandingWithoutFutureCheques,
          returnedChequesAmount,
          returnedChequesCount,
          invoices: invoiceSummaries
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
    setCollections(prev => [collection, ...prev]);
    if (selectedCustomer) {
      fetchCustomerInvoiceSummary(selectedCustomer.id);
    }
    setShowCollectionForm(false);
  };

  const handleCollectionFormSubmit = async (formData: any) => {
    try {
      // All payments are now direct payments allocated to specific invoices
      const status = 'allocated';
      
      // Create a new collection object with database field names
      const newCollection = {
        customer_id: formData.customerId,
        customer_name: formData.customerName,
        agency_id: user.agencyId,
        total_amount: formData.totalAmount,
        payment_method: formData.paymentMethod,
        cash_amount: formData.cashAmount,
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
          description: "Failed to save collection",
          variant: "destructive",
        });
        return;
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
        totalAmount: savedCollection.total_amount,
        paymentMethod: savedCollection.payment_method,
        cashAmount: savedCollection.cash_amount,
        chequeAmount: savedCollection.cheque_amount,
        cashDate: new Date(savedCollection.cash_date),
        chequeDetails: [], // You might want to save cheque details separately
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
      
      const successMessage = "Payment recorded and allocated to invoices successfully";
      
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                <div className="text-sm text-gray-600">Total Collected</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  LKR {customerInvoiceSummary.outstandingWithCheques.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Outstanding (With Cheques)</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-xl font-bold text-orange-600">
                  LKR {customerInvoiceSummary.outstandingWithoutCheques.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Outstanding (Without Future Cheques)</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {customerInvoiceSummary.returnedChequesCount} ({customerInvoiceSummary.returnedChequesAmount > 0 ? `LKR ${customerInvoiceSummary.returnedChequesAmount.toLocaleString()}` : 'LKR 0'})
                </div>
                <div className="text-sm text-gray-600">Returned Cheques</div>
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