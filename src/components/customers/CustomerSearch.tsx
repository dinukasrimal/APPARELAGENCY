
import { useState, useEffect } from 'react';
import { Customer } from '@/types/customer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, User, MapPin } from 'lucide-react';

interface CustomerSearchProps {
  customers: Customer[];
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer) => void;
  onCustomerChange: () => void;
  disabled?: boolean;
}

const CustomerSearch = ({ 
  customers, 
  selectedCustomer, 
  onCustomerSelect, 
  onCustomerChange,
  disabled = false 
}: CustomerSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        customer.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
      setShowResults(true);
    } else {
      setShowResults(false);
      setFilteredCustomers([]);
    }
  }, [searchTerm, customers]);

  const handleCustomerSelect = (customer: Customer) => {
    if (selectedCustomer && selectedCustomer.id !== customer.id) {
      // Customer is changing, trigger reset
      onCustomerChange();
    }
    onCustomerSelect(customer);
    setSearchTerm('');
    setShowResults(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value === '' && selectedCustomer) {
      // Clear selection if search is cleared
      onCustomerChange();
    }
  };

  return (
    <div className="relative">
      {selectedCustomer ? (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 shadow-lg rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 text-lg">{selectedCustomer.name}</h4>
                  <p className="text-blue-700 font-medium">{selectedCustomer.phone}</p>
                  <div className="flex items-center gap-2 text-sm text-blue-600 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedCustomer.address}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={onCustomerChange}
                disabled={disabled}
                className="h-12 px-6 rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
              >
                Change Customer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <Input
              type="text"
              placeholder="Search customers by name, phone, or address..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-12 h-14 text-base bg-white/90 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              disabled={disabled}
            />
          </div>
          
          {showResults && filteredCustomers.length > 0 && (
            <Card className="absolute z-10 w-full mt-2 max-h-80 overflow-y-auto bg-white/95 backdrop-blur-sm border border-slate-200 shadow-2xl rounded-2xl">
              <CardContent className="p-3">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 hover:bg-blue-50 cursor-pointer rounded-xl border-b border-slate-100 last:border-b-0 transition-all duration-200 group"
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-200">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 group-hover:text-blue-800 transition-colors duration-200">{customer.name}</div>
                        <div className="text-sm text-slate-600 font-medium">{customer.phone}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {customer.address}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {showResults && filteredCustomers.length === 0 && (
            <Card className="absolute z-10 w-full mt-2 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-2xl rounded-2xl">
              <CardContent className="p-6 text-center">
                <div className="bg-slate-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No customers found</p>
                <p className="text-sm text-slate-500 mt-1">No results for "{searchTerm}"</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
