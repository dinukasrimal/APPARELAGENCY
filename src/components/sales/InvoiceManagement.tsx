import { useState } from 'react';
import { User } from '@/types/auth';
import { Invoice, SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, Printer, FileText } from 'lucide-react';
import InvoiceDetails from './InvoiceDetails';
import PrintableInvoice from './PrintableInvoice';

interface InvoiceManagementProps {
  user: User;
  invoices: Invoice[];
  orders: SalesOrder[];
}

const InvoiceManagement = ({ user, invoices, orders }: InvoiceManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);

  // Filter invoices based on user role and filters
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (invoice.salesOrderId && invoice.salesOrderId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAgency = user.role === 'superuser' || invoice.agencyId === user.agencyId;
    
    return matchesSearch && matchesAgency;
  });

  const getSalesOrder = (salesOrderId?: string) => {
    return salesOrderId ? orders.find(order => order.id === salesOrderId) : null;
  };

  const handlePrint = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPrintView(true);
  };

  const handlePrintComplete = () => {
    setShowPrintView(false);
    setSelectedInvoice(null);
  };

  if (showPrintView && selectedInvoice) {
    return (
      <PrintableInvoice
        invoice={selectedInvoice}
        salesOrder={getSalesOrder(selectedInvoice.salesOrderId)}
        onClose={handlePrintComplete}
      />
    );
  }

  if (selectedInvoice) {
    return (
      <InvoiceDetails
        invoice={selectedInvoice}
        salesOrder={getSalesOrder(selectedInvoice.salesOrderId)}
        onBack={() => setSelectedInvoice(null)}
        onPrint={() => handlePrint(selectedInvoice)}
      />
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 h-full flex flex-col">
      {/* Header - More compact */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="text-sm md:text-base text-gray-600">
            {user.role === 'superuser' ? 'All invoices across agencies' : 'Your agency invoices'}
          </p>
        </div>
      </div>

      {/* Search - More compact */}
      <div className="relative">
        <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 md:h-4 md:w-4" />
        <Input
          placeholder="Search by invoice ID, order ID, or customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-7 md:pl-10 h-9 md:h-10 text-sm"
        />
      </div>

      {/* Invoices List - Grid layout for tablets */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-6 md:py-12 flex-1 flex flex-col items-center justify-center">
          <FileText className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-2 md:mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">No invoices found</h3>
          <p className="text-sm md:text-base text-gray-600">
            {searchTerm 
              ? 'Try adjusting your search criteria'
              : 'No invoices have been created yet'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 flex-1 overflow-y-auto">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                      <h3 className="font-semibold text-base md:text-lg truncate">{invoice.invoiceNumber}</h3>
                      <Badge variant="default" className="text-xs">Invoice</Badge>
                      {invoice.salesOrderId && (
                        <Badge variant="outline" className="text-xs">
                          Order: {invoice.salesOrderId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{invoice.customerName}</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="text-right">
                      <p className="text-lg md:text-xl font-bold">LKR {invoice.total.toLocaleString()}</p>
                      <p className="text-xs md:text-sm text-gray-500">
                        {invoice.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-1 md:gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-xs h-7 md:h-8"
                      >
                        <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700 text-xs h-7 md:h-8"
                        onClick={() => handlePrint(invoice)}
                      >
                        <Printer className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        Print
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceManagement;
