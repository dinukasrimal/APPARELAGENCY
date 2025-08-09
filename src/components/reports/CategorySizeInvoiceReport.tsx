import { useState, useEffect, useRef } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronDown, ChevronRight, Package, TrendingUp, Download, Filter, Search, User as UserIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CategorySizeInvoiceReportProps {
  user: User;
  onBack: () => void;
}

interface Customer {
  id: string;
  name: string;
}

interface SizeData {
  quantity: number;
  amount: number;
}

interface ColorData {
  color: string;
  totalAmount: number;
  totalQuantity: number;
  sizes: {
    [size: string]: SizeData;
  };
}

interface SubCategoryData {
  subCategory: string;
  totalAmount: number;
  totalQuantity: number;
  colors: {
    [color: string]: ColorData;
  };
}

interface CategoryData {
  category: string;
  totalAmount: number;
  totalQuantity: number;
  subCategories: {
    [subCategory: string]: SubCategoryData;
  };
}

interface ReportData {
  [category: string]: CategoryData;
}

const CategorySizeInvoiceReport = ({ user, onBack }: CategorySizeInvoiceReportProps) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('All customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [reportData, setReportData] = useState<ReportData>({});
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('CategorySizeInvoiceReport component mounted');
    fetchCustomers();
    
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchCustomers = async () => {
    try {
      console.log('Fetching customers...');
      let query = supabase
        .from('customers')
        .select('id, name')
        .order('name');

      // Filter by agency for non-superusers
      if (user.role !== 'superuser' && user.agencyId) {
        query = query.eq('agency_id', user.agencyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: "Error",
          description: "Failed to fetch customers",
          variant: "destructive",
        });
        return;
      }

      console.log('Customers fetched:', data?.length || 0);
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchReportData = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching report data...', { startDate, endDate, selectedCustomer });

      // Step 1: Get invoices in date range
      let invoiceQuery = supabase
        .from('invoices')
        .select('id, customer_id, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      // Filter by customer if selected
      if (selectedCustomer && selectedCustomer !== 'all') {
        invoiceQuery = invoiceQuery.eq('customer_id', selectedCustomer);
      }

      const { data: invoices, error: invoiceError } = await invoiceQuery;

      if (invoiceError) {
        console.error('Error fetching invoices:', invoiceError);
        toast({
          title: "Error",
          description: `Failed to fetch invoices: ${invoiceError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!invoices || invoices.length === 0) {
        console.log('No invoices found for the date range');
        setReportData({});
        toast({
          title: "No Data",
          description: "No invoices found for the selected date range and customer",
        });
        return;
      }

      console.log('Found invoices:', invoices.length);

      // Step 2: Get invoice items for these invoices
      const invoiceIds = invoices.map(inv => inv.id);
      
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('invoice_items')
        .select(`
          quantity,
          unit_price,
          product_id,
          invoice_id,
          color,
          size,
          products!inner(
            name,
            category,
            sub_category,
            sizes
          )
        `)
        .in('invoice_id', invoiceIds);

      if (itemsError) {
        console.error('Error fetching invoice items:', itemsError);
        toast({
          title: "Error",
          description: `Failed to fetch invoice items: ${itemsError.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Invoice items fetched:', invoiceItems?.length || 0, 'items');
      const data = invoiceItems;

      // Process the data to group by category -> sub-category -> color -> size
      const processedData: ReportData = {};

      data?.forEach((item: any) => {
        if (!item.products) return;

        const category = item.products.category || 'Uncategorized';
        const subCategory = item.products.sub_category || 'No Sub-Category';
        const color = item.color || 'No Color';
        const size = item.size || 'No Size';
        const quantity = item.quantity || 0;
        const amount = (item.quantity || 0) * (item.unit_price || 0);

        // Initialize category if it doesn't exist
        if (!processedData[category]) {
          processedData[category] = {
            category,
            totalAmount: 0,
            totalQuantity: 0,
            subCategories: {},
          };
        }

        // Initialize sub-category if it doesn't exist
        if (!processedData[category].subCategories[subCategory]) {
          processedData[category].subCategories[subCategory] = {
            subCategory,
            totalAmount: 0,
            totalQuantity: 0,
            colors: {},
          };
        }

        // Initialize color if it doesn't exist
        if (!processedData[category].subCategories[subCategory].colors[color]) {
          processedData[category].subCategories[subCategory].colors[color] = {
            color,
            totalAmount: 0,
            totalQuantity: 0,
            sizes: {},
          };
        }

        // Initialize size if it doesn't exist
        if (!processedData[category].subCategories[subCategory].colors[color].sizes[size]) {
          processedData[category].subCategories[subCategory].colors[color].sizes[size] = {
            quantity: 0,
            amount: 0,
          };
        }

        // Add to all levels of totals
        processedData[category].totalAmount += amount;
        processedData[category].totalQuantity += quantity;
        
        processedData[category].subCategories[subCategory].totalAmount += amount;
        processedData[category].subCategories[subCategory].totalQuantity += quantity;
        
        processedData[category].subCategories[subCategory].colors[color].totalAmount += amount;
        processedData[category].subCategories[subCategory].colors[color].totalQuantity += quantity;
        
        processedData[category].subCategories[subCategory].colors[color].sizes[size].quantity += quantity;
        processedData[category].subCategories[subCategory].colors[color].sizes[size].amount += amount;
      });

      setReportData(processedData);
      
      // Expand all categories by default
      setExpandedCategories(new Set(Object.keys(processedData)));
      
      // Expand all sub-categories by default
      const allSubCategoryKeys = Object.values(processedData).flatMap(cat => 
        Object.keys(cat.subCategories).map(subCat => `${cat.category}:${subCat}`)
      );
      setExpandedSubCategories(new Set(allSubCategoryKeys));
      
      // Keep colors collapsed by default

      toast({
        title: "Success",
        description: `Report generated with ${Object.keys(processedData).length} categories`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubCategory = (category: string, subCategory: string) => {
    const key = `${category}:${subCategory}`;
    const newExpanded = new Set(expandedSubCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubCategories(newExpanded);
  };

  const toggleColor = (category: string, subCategory: string, color: string) => {
    const key = `${category}:${subCategory}:${color}`;
    const newExpanded = new Set(expandedColors);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedColors(newExpanded);
  };

  const exportToCSV = () => {
    const csvRows = [];
    csvRows.push(['Category', 'Sub-Category', 'Color', 'Size', 'Quantity', 'Amount']);

    Object.values(reportData).forEach((categoryData) => {
      Object.values(categoryData.subCategories).forEach((subCategoryData) => {
        Object.values(subCategoryData.colors).forEach((colorData) => {
          Object.entries(colorData.sizes).forEach(([size, sizeData]) => {
            csvRows.push([
              categoryData.category,
              subCategoryData.subCategory,
              colorData.color,
              size,
              sizeData.quantity.toString(),
              sizeData.amount.toFixed(2)
            ]);
          });
        });
      });
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `category-size-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalCategories = Object.keys(reportData).length;
  const grandTotalAmount = Object.values(reportData).reduce((sum, cat) => sum + cat.totalAmount, 0);
  const grandTotalQuantity = Object.values(reportData).reduce((sum, cat) => sum + cat.totalQuantity, 0);

  console.log('Rendering CategorySizeInvoiceReport', { 
    totalCategories, 
    grandTotalAmount, 
    grandTotalQuantity,
    loading,
    customersCount: customers.length 
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Category & Size Invoice Report</h1>
          <p className="text-gray-600">Analyze invoiced amounts by product category and size</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Select date range and customer to generate the report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="relative" ref={customerDropdownRef}>
              <Label htmlFor="customer">Customer (Optional)</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Search customers or select all..."
                  value={customerSearchTerm}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="pl-10"
                />
                {selectedCustomer !== 'all' && selectedCustomerName !== 'All customers' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                    onClick={() => {
                      setSelectedCustomer('all');
                      setSelectedCustomerName('All customers');
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {/* Selected Customer Display */}
              {selectedCustomer !== 'all' && selectedCustomerName !== 'All customers' && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{selectedCustomerName}</span>
                  </div>
                </div>
              )}
              
              {/* Searchable Dropdown */}
              {showCustomerDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {/* All customers option */}
                  <div
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                    onClick={() => {
                      setSelectedCustomer('all');
                      setSelectedCustomerName('All customers');
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">All customers</div>
                        <div className="text-xs text-gray-500">Include all customers in report</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Filtered customers */}
                  {customers
                    .filter(customer => 
                      customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
                    )
                    .map((customer) => (
                      <div
                        key={customer.id}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedCustomer(customer.id);
                          setSelectedCustomerName(customer.name);
                          setCustomerSearchTerm('');
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{customer.name}</div>
                            <div className="text-xs text-gray-500">Customer ID: {customer.id}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                  
                  {/* No results */}
                  {customerSearchTerm && customers.filter(customer => 
                    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-4 text-center text-gray-500">
                      <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <div className="text-sm">No customers found</div>
                      <div className="text-xs">Try a different search term</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchReportData} disabled={loading} className="flex-1">
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              {Object.keys(reportData).length > 0 && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {Object.keys(reportData).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Categories</p>
                  <p className="text-2xl font-bold">{totalCategories}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Quantity</p>
                  <p className="text-2xl font-bold">{grandTotalQuantity.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">Rs. {grandTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Data */}
      {Object.keys(reportData).length > 0 ? (
        <div className="space-y-4">
          {Object.values(reportData)
            .sort((a, b) => b.totalAmount - a.totalAmount) // Sort by total amount descending
            .map((categoryData) => (
              <Card key={categoryData.category}>
                {/* Category Level */}
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCategory(categoryData.category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedCategories.has(categoryData.category) ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{categoryData.category}</CardTitle>
                        <CardDescription>
                          {Object.keys(categoryData.subCategories).length} sub-categories • {categoryData.totalQuantity} items
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        Rs. {categoryData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                {/* Sub-Categories */}
                {expandedCategories.has(categoryData.category) && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {Object.values(categoryData.subCategories)
                        .sort((a, b) => b.totalAmount - a.totalAmount)
                        .map((subCategoryData) => (
                          <Card key={subCategoryData.subCategory} className="border-l-4 border-l-blue-400">
                            <CardHeader 
                              className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
                              onClick={() => toggleSubCategory(categoryData.category, subCategoryData.subCategory)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {expandedSubCategories.has(`${categoryData.category}:${subCategoryData.subCategory}`) ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                  <div>
                                    <CardTitle className="text-base font-medium">{subCategoryData.subCategory}</CardTitle>
                                    <CardDescription className="text-sm">
                                      {Object.keys(subCategoryData.colors).length} colors • {subCategoryData.totalQuantity} items
                                    </CardDescription>
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-sm">
                                  Rs. {subCategoryData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </Badge>
                              </div>
                            </CardHeader>
                            
                            {/* Colors */}
                            {expandedSubCategories.has(`${categoryData.category}:${subCategoryData.subCategory}`) && (
                              <CardContent className="pt-0 pb-3">
                                <div className="space-y-2">
                                  {Object.values(subCategoryData.colors)
                                    .sort((a, b) => b.totalAmount - a.totalAmount)
                                    .map((colorData) => (
                                      <Card key={colorData.color} className="border-l-4 border-l-green-400">
                                        <CardHeader 
                                          className="cursor-pointer hover:bg-gray-50 transition-colors py-2"
                                          onClick={() => toggleColor(categoryData.category, subCategoryData.subCategory, colorData.color)}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              {expandedColors.has(`${categoryData.category}:${subCategoryData.subCategory}:${colorData.color}`) ? (
                                                <ChevronDown className="h-3 w-3 text-gray-500" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-gray-500" />
                                              )}
                                              <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-4 h-4 rounded-full border border-gray-300"
                                                  style={{ backgroundColor: colorData.color.toLowerCase() === 'no color' ? '#f3f4f6' : colorData.color }}
                                                  title={colorData.color}
                                                />
                                                <span className="text-sm font-medium">{colorData.color}</span>
                                                <span className="text-xs text-gray-500">
                                                  ({Object.keys(colorData.sizes).length} sizes, {colorData.totalQuantity} items)
                                                </span>
                                              </div>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                              Rs. {colorData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </Badge>
                                          </div>
                                        </CardHeader>
                                        
                                        {/* Sizes */}
                                        {expandedColors.has(`${categoryData.category}:${subCategoryData.subCategory}:${colorData.color}`) && (
                                          <CardContent className="pt-0 pb-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                              {Object.entries(colorData.sizes)
                                                .sort(([, a], [, b]) => b.amount - a.amount)
                                                .map(([size, sizeData]) => (
                                                  <div key={size} className="p-2 border rounded bg-gray-50">
                                                    <div className="flex justify-between items-start">
                                                      <div>
                                                        <p className="text-sm font-medium text-gray-900">{size}</p>
                                                        <p className="text-xs text-gray-600">{sizeData.quantity} items</p>
                                                      </div>
                                                      <p className="text-sm font-semibold text-green-600">
                                                        Rs. {sizeData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                      </p>
                                                    </div>
                                                  </div>
                                                ))}
                                            </div>
                                          </CardContent>
                                        )}
                                      </Card>
                                    ))}
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      ) : (
        !loading && (
          <Card>
            <CardContent className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
              <p className="text-gray-600">
                No invoice data found for the selected filters. Try adjusting your date range or customer selection.
              </p>
            </CardContent>
          </Card>
        )
      )}

      {loading && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading report data...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CategorySizeInvoiceReport;