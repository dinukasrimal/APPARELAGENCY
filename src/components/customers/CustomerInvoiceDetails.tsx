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
      
      // Calculate summary
      calculateCustomerSummary(transformedInvoices, transformedCollections);
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

  const calculateCustomerSummary = (customerInvoices: Invoice[], customerCollections: Collection[]) => {
    const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCollected = customerCollections.reduce((sum, col) => sum + col.totalAmount, 0);
    const outstandingAmount = totalInvoiced - totalCollected;

    // Calculate cheque-related amounts
    let futureChequeAmount = 0;
    let returnedChequesAmount = 0;
    let returnedChequesCount = 0;

    customerCollections.forEach(collection => {
      collection.chequeDetails.forEach(cheque => {
        const chequeDate = new Date(cheque.chequeDate);
        const today = new Date();
        
        if (cheque.status === 'returned') {
          returnedChequesAmount += cheque.amount;
          returnedChequesCount += 1;
        } else if (cheque.status === 'pending' && chequeDate > today) {
          // Future dated cheques
          futureChequeAmount += cheque.amount;
        }
      });
    });

    // Outstanding with cheques includes future cheques
    const outstandingWithCheques = outstandingAmount;
    // Outstanding without cheques excludes future cheque amounts
    const outstandingWithoutCheques = outstandingAmount - futureChequeAmount;

    const invoiceSummaries: InvoiceSummary[] = customerInvoices.map(invoice => {
      const collectedAmount = 0; // TODO: Calculate actual collected amount per invoice
      const outstandingAmount = invoice.total - collectedAmount;
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || invoice.id,
        total: invoice.total,
        collectedAmount,
        outstandingAmount,
        createdAt: new Date(invoice.createdAt),
        status: outstandingAmount === 0 ? 'paid' : 
                collectedAmount > 0 ? 'partially_paid' : 'pending'
      };
    });

    setCustomerInvoiceSummary({
      customerId: customer.id,
      customerName: customer.name,
      totalInvoiced,
      totalCollected,
      outstandingAmount,
      outstandingWithCheques,
      outstandingWithoutCheques,
      returnedChequesAmount,
      returnedChequesCount,
      invoices: invoiceSummaries
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

      toast({
        title: "Success",
        description: "Collection recorded successfully",
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
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span>{customer.phone}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      <div className="text-lg font-bold">
                        LKR {invoice.total.toLocaleString()}
                      </div>
                      <div className="text-sm text-red-600">
                        Outstanding: LKR {invoice.total.toLocaleString()}
                      </div>
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