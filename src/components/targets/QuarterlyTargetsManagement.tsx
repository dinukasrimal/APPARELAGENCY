
import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { QuarterlyTarget } from '@/types/targets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Target, TrendingUp, Calendar, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuarterlyTargetsManagementProps {
  user: User;
}

const QuarterlyTargetsManagement = ({ user }: QuarterlyTargetsManagementProps) => {
  const [targets, setTargets] = useState<QuarterlyTarget[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<{id: string, name: string}[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Filter states for superuser
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  // Filter states for agency users
  const [agencySelectedQuarter, setAgencySelectedQuarter] = useState('all');
  const [agencySelectedYear, setAgencySelectedYear] = useState('all');

  // Form state for creating new targets
  const [newTarget, setNewTarget] = useState({
    quarter: 'Q1' as 'Q1' | 'Q2' | 'Q3' | 'Q4',
    year: new Date().getFullYear().toString(),
    productCategory: '',
    targetAmount: '',
    agencyId: ''
  });

  useEffect(() => {
    fetchTargets();
    fetchCategories();
    if (user.role === 'superuser') {
      fetchAgencies();
    }
  }, [user]);

  const fetchTargets = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching targets for user:', user.role, user.agencyId);

      let query = supabase.from('quarterly_targets').select('*');

      // Filter based on user role
      if (user.role === 'agent' || user.role === 'agency') {
        query = query.eq('agency_id', user.agencyId);
      }

      const { data: targetsData, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Fetched targets:', targetsData);

      // Calculate achievements for each target
      const targetsWithAchievements = await Promise.all(
        (targetsData || []).map(async (target) => {
          const achievement = await calculateAchievement(
            target.quarter,
            target.year,
            target.product_category,
            target.agency_id
          );

          return {
            id: target.id,
            quarter: target.quarter as 'Q1' | 'Q2' | 'Q3' | 'Q4',
            year: target.year,
            productCategory: target.product_category,
            targetAmount: Number(target.target_amount),
            achievedAmount: achievement,
            agencyId: target.agency_id,
            agencyName: target.agency_name,
            createdBy: target.created_by,
            createdAt: new Date(target.created_at),
            updatedAt: new Date(target.updated_at)
          };
        })
      );

      setTargets(targetsWithAchievements);
    } catch (error) {
      console.error('Error fetching targets:', error);
      toast({
        title: "Error",
        description: "Failed to load targets",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAchievement = async (quarter: string, year: number, category: string, agencyId?: string) => {
    try {
      console.log(`Calculating achievement for ${quarter} ${year}, category: ${category}, agency: ${agencyId}`);

      // Define quarter date ranges
      const quarterMap = {
        'Q1': { start: 0, end: 2 }, // Jan-Mar (0-based months)
        'Q2': { start: 3, end: 5 }, // Apr-Jun
        'Q3': { start: 6, end: 8 }, // Jul-Sep
        'Q4': { start: 9, end: 11 } // Oct-Dec
      };

      const quarterRange = quarterMap[quarter as keyof typeof quarterMap];
      const startDate = new Date(year, quarterRange.start, 1);
      const endDate = new Date(year, quarterRange.end + 1, 0); // Last day of the quarter

      console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Build query for invoices in the quarter
      let invoicesQuery = supabase
        .from('invoices')
        .select('id')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Filter by agency if specified
      if (agencyId) {
        invoicesQuery = invoicesQuery.eq('agency_id', agencyId);
      }

      const { data: invoices, error: invoicesError } = await invoicesQuery;

      if (invoicesError) throw invoicesError;

      if (!invoices || invoices.length === 0) {
        console.log('No invoices found for the period');
        return 0;
      }

      console.log(`Found ${invoices.length} invoices in the quarter`);

      // Get invoice items for these invoices that match the category
      const invoiceIds = invoices.map(inv => inv.id);
      
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('invoice_items')
        .select(`
          total,
          products!inner(category)
        `)
        .in('invoice_id', invoiceIds)
        .eq('products.category', category);

      if (itemsError) throw itemsError;

      console.log(`Found ${invoiceItems?.length || 0} invoice items for category ${category}`);

      // Sum up the total amounts
      const totalAchieved = (invoiceItems || []).reduce((sum, item) => {
        return sum + Number(item.total);
      }, 0);

      console.log(`Total achieved: ${totalAchieved}`);
      return totalAchieved;
    } catch (error) {
      console.error('Error calculating achievement:', error);
      return 0;
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null);

      if (error) throw error;

      const uniqueCategories = [...new Set(data.map(item => item.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setAgencies(data);
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  const handleCreateTarget = async () => {
    try {
      if (!newTarget.productCategory || !newTarget.targetAmount || !newTarget.agencyId) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      const selectedAgency = agencies.find(a => a.id === newTarget.agencyId);

      const targetData = {
        quarter: newTarget.quarter,
        year: parseInt(newTarget.year),
        product_category: newTarget.productCategory,
        target_amount: Number(newTarget.targetAmount),
        agency_id: newTarget.agencyId,
        agency_name: selectedAgency?.name,
        created_by: user.id
      };

      const { error } = await supabase
        .from('quarterly_targets')
        .insert(targetData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Target created successfully",
      });

      setShowCreateForm(false);
      setNewTarget({
        quarter: 'Q1',
        year: new Date().getFullYear().toString(),
        productCategory: '',
        targetAmount: '',
        agencyId: ''
      });
      fetchTargets();
    } catch (error) {
      console.error('Error creating target:', error);
      toast({
        title: "Error",
        description: "Failed to create target",
        variant: "destructive"
      });
    }
  };

  // Filter targets for display based on user role
  const filteredTargets = targets.filter(target => {
    if (user.role === 'superuser') {
      const matchesAgency = selectedAgency === 'all' || target.agencyId === selectedAgency;
      const matchesQuarter = selectedQuarter === 'all' || target.quarter === selectedQuarter;
      const matchesYear = selectedYear === 'all' || target.year.toString() === selectedYear;
      
      return matchesAgency && matchesQuarter && matchesYear;
    } else {
      // For agency/agent users, filter by their selected quarter and year
      const matchesQuarter = agencySelectedQuarter === 'all' || target.quarter === agencySelectedQuarter;
      const matchesYear = agencySelectedYear === 'all' || target.year.toString() === agencySelectedYear;
      
      return matchesQuarter && matchesYear;
    }
  });

  // Calculate summary
  const totalTarget = filteredTargets.reduce((sum, t) => sum + t.targetAmount, 0);
  const totalAchieved = filteredTargets.reduce((sum, t) => sum + t.achievedAmount, 0);
  const achievementPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const years = [...new Set(targets.map(t => t.year))].sort((a, b) => b - a);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading targets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quarterly Targets</h2>
          <p className="text-gray-600">
            {user.role === 'superuser' 
              ? 'Manage and view all agency targets'
              : user.role === 'agency'
              ? 'View your agency targets'
              : 'View your assigned targets'
            }
          </p>
        </div>
        {user.role === 'superuser' && (
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Set New Target
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Target</p>
                <p className="text-2xl font-bold">Rs {totalTarget.toLocaleString()}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Achieved</p>
                <p className="text-2xl font-bold">Rs {totalAchieved.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Achievement</p>
                <p className="text-2xl font-bold">{achievementPercentage.toFixed(1)}%</p>
              </div>
              <div className="w-16">
                <Progress value={achievementPercentage} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Form for Superuser */}
      {showCreateForm && user.role === 'superuser' && (
        <Card>
          <CardHeader>
            <CardTitle>Set New Quarterly Target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Agency *</Label>
                <Select value={newTarget.agencyId} onValueChange={(value) => setNewTarget({...newTarget, agencyId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quarter *</Label>
                <Select value={newTarget.quarter} onValueChange={(value) => setNewTarget({...newTarget, quarter: value as 'Q1' | 'Q2' | 'Q3' | 'Q4'})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map((quarter) => (
                      <SelectItem key={quarter} value={quarter}>
                        {quarter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year *</Label>
                <Select value={newTarget.year} onValueChange={(value) => setNewTarget({...newTarget, year: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Product Category *</Label>
                <Select value={newTarget.productCategory} onValueChange={(value) => setNewTarget({...newTarget, productCategory: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Amount (Rs) *</Label>
                <Input
                  type="number"
                  placeholder="Enter target amount"
                  value={newTarget.targetAmount}
                  onChange={(e) => setNewTarget({...newTarget, targetAmount: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleCreateTarget} 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!newTarget.productCategory || !newTarget.targetAmount || !newTarget.agencyId}
              >
                Create Target
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {user.role === 'superuser' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={selectedAgency} onValueChange={setSelectedAgency}>
            <SelectTrigger>
              <SelectValue placeholder="All Agencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies</SelectItem>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger>
              <SelectValue placeholder="All Quarters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              {quarters.map((quarter) => (
                <SelectItem key={quarter} value={quarter}>
                  {quarter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => {
            setSelectedAgency('all');
            setSelectedQuarter('all');
            setSelectedYear('all');
          }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select value={agencySelectedQuarter} onValueChange={setAgencySelectedQuarter}>
            <SelectTrigger>
              <SelectValue placeholder="All Quarters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              {quarters.map((quarter) => (
                <SelectItem key={quarter} value={quarter}>
                  {quarter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agencySelectedYear} onValueChange={setAgencySelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => {
            setAgencySelectedQuarter('all');
            setAgencySelectedYear('all');
          }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Targets List */}
      <div className="space-y-4">
        {filteredTargets.map((target) => {
          const progress = target.targetAmount > 0 ? (target.achievedAmount / target.targetAmount) * 100 : 0;
          const isOnTrack = progress >= 75;
          
          return (
            <Card key={target.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 rounded-lg p-3">
                      <Target className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{target.productCategory}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{target.quarter} {target.year}</span>
                        {target.agencyName && (
                          <>
                            <span>•</span>
                            <Building2 className="h-4 w-4" />
                            <span>{target.agencyName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={isOnTrack ? 'default' : 'secondary'}>
                    {isOnTrack ? 'On Track' : 'Behind Target'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Target Amount</p>
                    <p className="text-xl font-semibold">Rs {target.targetAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Achieved</p>
                    <p className="text-xl font-semibold">Rs {target.achievedAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="text-xl font-semibold">{progress.toFixed(1)}%</p>
                  </div>
                </div>

                <Progress value={progress} className="h-3" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTargets.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No targets found</h3>
          <p className="text-gray-600">
            {user.role === 'superuser' 
              ? 'No targets have been set yet. Create your first target to get started.'
              : 'No targets have been assigned to you yet.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default QuarterlyTargetsManagement;
