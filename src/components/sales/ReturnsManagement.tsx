import { useState } from 'react';
import { User } from '@/types/auth';
import { Invoice, Return } from '@/types/sales';
import { Customer } from '@/types/customer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Plus, RotateCcw } from 'lucide-react';
import CreateReturnForm from './CreateReturnForm';

interface ReturnsManagementProps {
  user: User;
  returns: Return[];
  invoices: Invoice[];
  customers: Customer[];
}

const ReturnsManagement = ({ user, returns, invoices, customers }: ReturnsManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);

  // Filter returns based on user role and filters
  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = returnItem.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         returnItem.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         returnItem.invoiceId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || returnItem.status === statusFilter;
    const matchesAgency = user.role === 'superuser' || returnItem.agencyId === user.agencyId;
    
    return matchesSearch && matchesStatus && matchesAgency;
  });

  const getStatusBadge = (status: Return['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      processed: { label: 'Processed', variant: 'default' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const }
    };
    
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleCreateReturn = (returnData: any) => {
    // Handle return creation
    console.log('Creating return:', returnData);
    setShowCreateForm(false);
  };

  if (showCreateForm) {
    return (
      <CreateReturnForm
        user={user}
        invoices={invoices}
        customers={customers}
        onSubmit={handleCreateReturn}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 h-full flex flex-col">
      {/* Header - More compact */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900">Returns Management</h3>
          <p className="text-sm md:text-base text-gray-600">
            {user.role === 'superuser' ? 'All returns across agencies' : 'Your agency returns'}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="bg-red-600 hover:bg-red-700 text-sm" size="sm">
          <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
          Process Return
        </Button>
      </div>

      {/* Filters - More compact */}
      <div className="flex gap-2 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 md:h-4 md:w-4" />
          <Input
            placeholder="Search by return ID, invoice ID, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 md:pl-10 h-9 md:h-10 text-sm"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 md:w-48 h-9 md:h-10 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Returns List - Grid layout for tablets */}
      {filteredReturns.length === 0 ? (
        <div className="text-center py-6 md:py-12 flex-1 flex flex-col items-center justify-center">
          <RotateCcw className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-2 md:mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-1 md:mb-2">No returns found</h3>
          <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-4">
            {searchTerm || (statusFilter !== 'all') 
              ? 'Try adjusting your search or filter criteria'
              : 'No returns have been processed yet'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button onClick={() => setShowCreateForm(true)} className="bg-red-600 hover:bg-red-700 text-sm" size="sm">
              <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Process Return
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 flex-1 overflow-y-auto">
          {filteredReturns.map((returnItem) => (
            <Card key={returnItem.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                      <h3 className="font-semibold text-base md:text-lg truncate">{returnItem.id}</h3>
                      {getStatusBadge(returnItem.status)}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{returnItem.customerName}</p>
                    <p className="text-xs md:text-sm text-gray-500">
                      Invoice: {returnItem.invoiceId} • {returnItem.items.length} items
                    </p>
                    <p className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2">{returnItem.reason}</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="text-right">
                      <p className="text-lg md:text-xl font-bold text-red-600">LKR {returnItem.total.toLocaleString()}</p>
                      <p className="text-xs md:text-sm text-gray-500">
                        {returnItem.createdAt.toLocaleDateString()}
                      </p>
                      {returnItem.processedAt && (
                        <p className="text-xs text-green-600">
                          Processed {returnItem.processedAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-1 md:gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedReturn(returnItem)}
                        className="text-xs h-7 md:h-8"
                      >
                        <Eye className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        View
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

export default ReturnsManagement;
