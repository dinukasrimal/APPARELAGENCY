import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Customer } from '@/types/customer';
import { Invoice } from '@/types/sales';
import { Collection, CustomerInvoiceSummary, InvoiceSummary } from '@/types/collections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, DollarSign, Plus, MapPin, Phone, Building, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CollectionForm } from '../collections/CollectionForm';
import { CollectionDetails } from '../collections/CollectionDetails';
import InvoiceDetails from '../sales/InvoiceDetails';

interface CustomerInvoiceDetailsProps {
  user: User;
  customer: Customer;
  onBack: () => void;
}

const CustomerInvoiceDetails = ({ user, customer, onBack }: CustomerInvoiceDetailsProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customerInvoiceSummary, setCustomerInvoiceSummary] = useState<CustomerInvoiceSummary | null>(null);
  const [customerReturns, setCustomerReturns] = useState<Array<{ id: string; invoice_id: string | null; total: number; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [viewingCollection, setViewingCollection] = useState<Collection | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomerData();
  }, [customer.id]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      
      // Fetch invoices for this customer
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        throw new Error(`Failed to fetch invoices: ${invoicesError.message}`);
      }

      // Transform invoices data
      const transformedInvoices: Invoice[] = (invoicesData || []).map(invoice => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || invoice.id,
        salesOrderId: invoice.sales_order_id,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        agencyId: invoice.agency_id,
        items: [],
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

      // Fetch collections for this customer
      let transformedCollections: Collection[] = [];
      try {
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('collections')
          .select(`
            *,
            collection_cheques (*),
            collection_allocations (*)
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (collectionsError) {
          console.warn('Collections table might not exist yet:', collectionsError);
        } else {
          transformedCollections = (collectionsData || []).map(collection => ({
            id: collection.id,
            customerId: collection.customer_id,
            customerName: collection.customer_name,
            agencyId: collection.agency_id,
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
        console.warn('Collections table not found:', collectionsError);
      }

      setInvoices(transformedInvoices);
      setCollections(transformedCollections);
      
      // Fetch returns for this customer (approved/processed)
      const { data: returnsData, error: returnsError } = await supabase
        .from('returns')
        .select('id, invoice_id, total, status')
        .eq('customer_id', customer.id)
        .in('status', ['approved', 'processed']);

      if (returnsError) {
        console.warn('Returns fetch issue:', returnsError);
        setCustomerReturns([]);
      } else {
        setCustomerReturns(returnsData || []);
      }
      
      // Calculate summary
      await calculateCustomerSummary(transformedInvoices, transformedCollections, returnsData || []);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateCustomerSummary = async (customerInvoices: Invoice[], customerCollections: Collection[], customerReturnsList: Array<{ id: string; invoice_id: string | null; total: number; status: string }>) => {
    // Calculate payments with proper date validation (same logic as Collections.tsx)
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
        
        if (cheque.status === 'returned') {
          // Returned cheques add back to outstanding
          returnedChequesAmount += cheque.amount;
          returnedChequesCount++;
        } else if (chequeDate <= today) {
          // Only count cheques whose date has arrived as realized payments
          totalRealizedChequePayments += cheque.amount;
        } else {
          // Future-dated cheques are unrealized payments
          totalUnrealizedChequePayments += cheque.amount;
        }
      });
    });

    // Calculate totals
    const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalReturns = customerReturnsList.reduce((sum, ret) => sum + (ret.total || 0), 0);
    const totalRealizedPayments = totalCashCollected + totalRealizedChequePayments + totalCashDiscounts;
    
    // Outstanding calculation:
    // Outstanding = Total Invoiced - Realized Payments - Returns + Returned Cheques
    // Future cheques don't count as payments until their date arrives
    const outstandingAmount = totalInvoiced - totalRealizedPayments - totalReturns + returnedChequesAmount;
    
    // Outstanding with Unrealized = Total Invoiced - (Realized + Unrealized) - Returns + Returned Cheques
    const totalAllPayments = totalRealizedPayments + totalUnrealizedChequePayments;
    const outstandingWithUnrealized = totalInvoiced - totalAllPayments - totalReturns + returnedChequesAmount;

    // Create invoice summaries with proper collection calculations
    // Build invoice item lookup to support per-item return linking
    const invoiceItemIds = Array.from(
      new Set(
        customerInvoices.flatMap((inv) => (inv.items || []).map((item) => item.id))
      )
    );
    const invoiceItemToInvoice: Record<string, string> = {};
    customerInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        invoiceItemToInvoice[item.id] = inv.id;
      });
    });

    let returnsByInvoiceItem: Record<string, number> = {};
    try {
      if (invoiceItemIds.length > 0) {
        const { data: returnItemsData, error: returnItemsError } = await supabase
          .from('return_items')
          .select('invoice_item_id,total')
          .in('invoice_item_id', invoiceItemIds);

        if (returnItemsError) {
          console.warn('Return items fetch issue:', returnItemsError);
        } else {
          const map: Record<string, number> = {};
          (returnItemsData || []).forEach((ri) => {
            if (ri.invoice_item_id && typeof ri.total === 'number') {
              map[ri.invoice_item_id] = (map[ri.invoice_item_id] || 0) + Number(ri.total);
            }
          });
          returnsByInvoiceItem = map;
        }
      }
    } catch (err) {
      console.warn('Return items lookup failed:', err);
    }

    const returnsByInvoiceId: Record<string, number> = {};
    Object.entries(returnsByInvoiceItem).forEach(([invoiceItemId, amount]) => {
      const invId = invoiceItemToInvoice[invoiceItemId];
      if (invId) {
        returnsByInvoiceId[invId] = (returnsByInvoiceId[invId] || 0) + amount;
      }
    });

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
        const invoiceReturnsFromHeader = customerReturnsList
          .filter((ret) => ret.invoice_id === invoice.id)
          .reduce((sum, ret) => sum + (ret.total || 0), 0);
        const invoiceReturnsFromItems = returnsByInvoiceId[invoice.id] || 0;
        const invoiceReturns = invoiceReturnsFromHeader + invoiceReturnsFromItems;
        const invoiceOutstandingAmount = invoice.total - collectedAmount - invoiceReturns;
        
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.id,
          total: invoice.total,
          collectedAmount,
          outstandingAmount: invoiceOutstandingAmount,
          createdAt: new Date(invoice.createdAt),
          status: invoiceOutstandingAmount === 0 ? 'paid' : 
                  collectedAmount > 0 ? 'partially_paid' : 'pending'
        };
      })
    );

    setCustomerInvoiceSummary({
      customerId: customer.id,
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
  };

  const handleCollectionFormSubmit = async (formData: any) => {
    try {
      const newCollection = {
        customer_id: customer.id,
        customer_name: customer.name,
        agency_id: user.agencyId,
        total_amount: formData.totalAmount,
        payment_method: formData.paymentMethod,
        cash_amount: formData.cashAmount,
        cash_discount: formData.cashDiscount,
        cheque_amount: formData.chequeAmount,
        cash_date: formData.cashDate.toISOString(),
        notes: formData.notes,
        latitude: formData.gpsCoordinates.latitude,
        longitude: formData.gpsCoordinates.longitude,
        status: 'pending',
        created_by: user.id
      };

      const { data: savedCollection, error } = await supabase
        .from('collections')
        .insert([newCollection])
        .select()
        .single();

      if (error) {
        throw error;
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

      const chequeCount = formData.chequeDetails?.length || 0;
      const successMessage = chequeCount > 0 
        ? `Collection recorded with ${chequeCount} cheque${chequeCount > 1 ? 's' : ''} successfully`
        : "Collection recorded successfully";

      toast({
        title: "Success",
        description: successMessage,
      });

      setShowCollectionForm(false);
      fetchCustomerData(); // Refresh data
    } catch (error) {
      console.error('Error saving collection:', error);
      toast({
        title: "Error",
        description: "Failed to save collection",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showCollectionForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowCollectionForm(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customer Details
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Record Collection</h2>
            <p className="text-gray-600">Record payment collection for {customer.name}</p>
          </div>
        </div>
        
        <CollectionForm
          customerId={customer.id}
          customerName={customer.name}
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

  if (selectedInvoice) {
    return (
      <InvoiceDetails
        invoice={selectedInvoice}
        onBack={() => setSelectedInvoice(null)}
        onPrint={() => {}}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
          <p className="text-gray-600">Customer invoices and collections</p>
        </div>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <div>{customer.phone}</div>
                {customer.secondaryPhone && (
                  <div className="text-sm text-gray-500 mt-1">Alt: {customer.secondaryPhone}</div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
              <span>{customer.address}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Summary */}
      {customerInvoiceSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Outstanding Summary
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
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
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-xl font-bold text-emerald-600">
                  LKR {(customerInvoiceSummary.totalReturns || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Approved Returns</div>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices</h3>
              <p className="text-gray-600">No invoices found for this customer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Invoice #{invoice.invoiceNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {invoice.createdAt.toLocaleDateString()}
                      </Badge>
                    </div>
                    {invoice.salesOrderId && (
                      <div className="text-sm text-gray-500">
                        Sales Order: {invoice.salesOrderId}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {(() => {
                        const summary = customerInvoiceSummary?.invoices.find((inv) => inv.id === invoice.id);
                        const collected = summary?.collectedAmount || 0;
                        const outstanding = summary?.outstandingAmount ?? invoice.total;
                        const returnsValue = invoice.total - collected - outstanding;
                        return (
                          <>
                            <div className="text-xs text-gray-500">
                              Returns: LKR {returnsValue.toLocaleString()}
                            </div>
                            <div className="text-lg font-bold">
                              LKR {invoice.total.toLocaleString()}
                            </div>
                            <div className="text-sm text-red-600">
                              Outstanding: LKR {outstanding.toLocaleString()}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Collections ({collections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collections.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Collections</h3>
              <p className="text-gray-600">No collections have been recorded for this customer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Collection #{collection.id.slice(-8)}</span>
                      <Badge variant="outline" className="text-xs">
                        {collection.createdAt.toLocaleDateString()}
                      </Badge>
                      <Badge variant={collection.status === 'pending' ? 'secondary' : 'default'}>
                        {collection.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      Payment Method: {collection.paymentMethod}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        LKR {collection.totalAmount.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {collection.cashAmount > 0 && `Cash: LKR ${collection.cashAmount.toLocaleString()}`}
                        {collection.chequeAmount > 0 && ` Cheque: LKR ${collection.chequeAmount.toLocaleString()}`}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingCollection(collection)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerInvoiceDetails;
