import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, TrendingUp, Calendar, Building2, ExternalLink, ChevronDown, ChevronRight, BarChart3, GitCompare, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useExternalTargetsWithAchievements, useExternalConnection } from '@/hooks/useExternalData';
import { ExternalDataService } from '@/services/external-data.service';
import { supabase } from '@/integrations/supabase/client';
import { chunkArray, fetchAllSupabaseRows } from '@/utils/supabasePagination';
import { monthStartDate, monthEndDate } from '@/utils/dateRange';
import AgencySelector from '@/components/common/AgencySelector';
import { useAgencies } from '@/hooks/useAgency';

interface QuarterlyTargetsManagementProps {
  user: User;
}

const getCurrentQuarter = (): 'Q1' | 'Q2' | 'Q3' | 'Q4' => {
  const month = new Date().getMonth() + 1;

  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
};

const months = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const QuarterlyTargetsManagement = ({ user }: QuarterlyTargetsManagementProps) => {
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    user.role === 'superuser' ? null : user.agencyId
  );
  const { toast } = useToast();
  const { agencies } = useAgencies();

  // External data hooks
  console.log('External hook called with user name:', currentUserName);
  const {
    targets: externalTargets,
    isLoading: externalLoading,
    error: externalError,
    isAvailable: externalAvailable,
    refetch: refetchTargets
  } = useExternalTargetsWithAchievements(currentUserName);
  
  const { isConnected, stats } = useExternalConnection();
  
  console.log('External targets loaded:', {
    count: externalTargets.length,
    loading: externalLoading,
    error: externalError,
    available: externalAvailable
  });
  
  // Debug: Log sample target data
  if (externalTargets.length > 0) {
    const sampleTarget = externalTargets[0];
    console.log('📋 Sample external target:', {
      customer_name: sampleTarget.customer_name,
      target_months: sampleTarget.target_months,
      target_year: sampleTarget.target_year,
      initial_total_value: sampleTarget.initial_total_value,
      adjusted_total_value: sampleTarget.adjusted_total_value,
      achievement: sampleTarget.achievement
    });
    
    // Test the parsing function
    const parsedMonths = ExternalDataService.getInstance().parseTargetMonths(sampleTarget.target_months);
    const quarter = ExternalDataService.getInstance().monthsToQuarter(parsedMonths);
    console.log('🧪 Parsing test:', {
      original: sampleTarget.target_months,
      parsed: parsedMonths,
      quarter: quarter
    });
  }

  // Tab state
  const [activeTab, setActiveTab] = useState('comparison');
  
  // Period filters for targets and comparisons
  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [comparisonMonth, setComparisonMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [comparisonYear, setComparisonYear] = useState<string>(new Date().getFullYear().toString());
  
  // Expandable card states
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [categoryBreakdowns, setCategoryBreakdowns] = useState<Map<string, Array<{category: string, target: number, achieved: number, percentage: number}>>>(new Map());
  
  // Comparison data state
  const [comparisonData, setComparisonData] = useState<{
    data: Array<{
      period: string;
      externalTarget: number;
      internalAchievement: number;
      achievementPercentage: number;
      gap: number;
    }>;
    summary: {
      totalExternalTarget: number;
      totalInternalAchievement: number;
      overallAchievementPercentage: number;
      totalGap: number;
    };
    error: string | null;
  } | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Category breakdown for comparison tab
  const [compCategoryData, setCompCategoryData] = useState<Array<{category: string; target: number; achieved: number}>>([]);
  const [compCategoryLoading, setCompCategoryLoading] = useState(false);

  // Internal Achievement drill-down (invoices behind the achievement figure)
  const [showAchievementInvoices, setShowAchievementInvoices] = useState(false);
  const [achievementInvoices, setAchievementInvoices] = useState<Array<{ id: string; invoiceNumber: string | null; customerName: string; total: number; createdAt: string }>>([]);
  const [achievementInvoicesLoading, setAchievementInvoicesLoading] = useState(false);

  const openAchievementInvoices = async () => {
    setShowAchievementInvoices(true);
    setAchievementInvoicesLoading(true);
    try {
      const year = parseInt(comparisonYear);
      const month = parseInt(comparisonMonth);
      const startDate = monthStartDate(year, month);
      const endDate = monthEndDate(year, month);
      const agencyId = user.role === 'superuser' ? selectedAgencyId : user.agencyId;
      const { data } = await ExternalDataService.getInstance().getInternalAchievementInvoices(
        user, startDate, endDate, agencyId
      );
      setAchievementInvoices(data);
    } catch (e) {
      setAchievementInvoices([]);
    } finally {
      setAchievementInvoicesLoading(false);
    }
  };

  const fetchCompCategoryBreakdown = async () => {
    // Superuser with no agency selected = aggregate across ALL agencies.
    const aggregateAll = user.role === 'superuser' && !selectedAgencyId;
    const agencyId = user.role === 'superuser' ? selectedAgencyId : user.agencyId;
    if (!aggregateAll && !agencyId) return;
    setCompCategoryLoading(true);
    try {
      const year = parseInt(comparisonYear);
      const month = parseInt(comparisonMonth);
      const from = new Date(year, month - 1, 1).toISOString();
      const to = new Date(year, month, 0, 23, 59, 59).toISOString();

      const externalSvc = ExternalDataService.getInstance();

      // 1. Targets: all agencies when aggregating, else the selected/own agency.
      //    Fetch straight from the service so it matches the summary figures
      //    (the externalTargets hook is name-filtered and empty for All agencies).
      const { data: targetsData } = await externalSvc.getSalesTargets(
        aggregateAll ? { year } : { userName: currentUserName || user.name || '', year }
      );

      const norm = (s: string) => (s || '').toLowerCase().trim();

      const targetMap = new Map<string, number>();   // display name -> target value
      (targetsData || []).forEach((t: any) => {
        const months = externalSvc.parseTargetMonths(t.target_months);
        if (!months.includes(month)) return;
        const rawYear = parseInt(t.target_year || t.year || '0');
        if (rawYear !== year) return;
        const cats = externalSvc.getTargetCategories(t.target_data);
        cats.forEach(({ category, target: tval }) => {
          targetMap.set(category, (targetMap.get(category) || 0) + tval);
        });
      });

      // 2. Achievement per category — from the APP's own invoices (same source
      //    as the "Internal Achievement" headline, so the category rows reconcile
      //    with it). Paginated so nothing caps at 1000 rows; item lookups chunked.
      const invoices = await fetchAllSupabaseRows<{ id: string }>(() => {
        let q = supabase
          .from('invoices')
          .select('id')
          .gte('created_at', from)
          .lte('created_at', to);
        if (!aggregateAll && agencyId) q = q.eq('agency_id', agencyId);
        return q;
      });
      const invoiceIds = (invoices || []).map((i) => i.id);

      // Resolve products manually (no FK embed — invoice_items may reference
      // external product ids). Match by product_id, then by product_name.
      const productRows = await fetchAllSupabaseRows<{ id: string; name: string | null; category: string | null; sub_category: string | null }>(
        () => supabase.from('products').select('id, name, category, sub_category')
      );
      const prodById = new Map(productRows.map((p) => [p.id, p]));
      const prodByName = new Map(productRows.map((p) => [norm(p.name || ''), p]));

      const achieveMap = new Map<string, number>();
      let unmatched = 0;
      if (invoiceIds.length > 0) {
        const itemChunks = await Promise.all(
          chunkArray(invoiceIds, 200).map((chunk) =>
            fetchAllSupabaseRows<any>(() =>
              supabase
                .from('invoice_items')
                .select('product_id, product_name, quantity, unit_price, total')
                .in('invoice_id', chunk)
            )
          )
        );
        itemChunks.flat().forEach((item: any) => {
          // Prefer the stored line total (net of any line discount); fall back to qty*price.
          const amount = Number(item.total) || (Number(item.quantity) * Number(item.unit_price));
          const p = prodById.get(item.product_id) || prodByName.get(norm(item.product_name || ''));
          if (!p) { unmatched += 1; return; }
          const keys = new Set<string>();
          if (p.category) keys.add(norm(p.category));
          if (p.sub_category) keys.add(norm(p.sub_category));
          keys.forEach((k) => achieveMap.set(k, (achieveMap.get(k) || 0) + amount));
        });
      }

      console.log('📊 Category breakdown:',
        '| period =', from, 'to', to,
        '| agencyId =', aggregateAll ? 'ALL' : agencyId,
        '| internal invoices =', invoiceIds.length,
        '| target cats =', Array.from(targetMap.keys()),
        '| achieved cats =', Array.from(achieveMap.keys()),
        '| unmatched items =', unmatched);

      // 3. Only categories that have a real (> 0) target assigned — sorted by achieved desc
      const result = Array.from(targetMap.entries())
        .filter(([, tval]) => tval > 0)
        .map(([cat, tval]) => ({
          category: cat,
          target: tval,
          achieved: achieveMap.get(norm(cat)) || 0,
        })).sort((a, b) => b.achieved - a.achieved);

      setCompCategoryData(result);
    } catch (err) {
      console.error('Error fetching category breakdown:', err);
      setCompCategoryData([]);
    } finally {
      setCompCategoryLoading(false);
    }
  };

  // Set agency name for targets filtering (either selected agency or user's agency)
  useEffect(() => {
    const setTargetAgencyName = async () => {
      setProfileLoading(true);
      try {
        let agencyName = null;
        
        if (user.role === 'superuser' && selectedAgencyId) {
          // For superusers, use selected agency name
          const selectedAgency = agencies.find(a => a.id === selectedAgencyId);
          agencyName = selectedAgency?.name || null;
          console.log('🏢 Superuser selected agency:', agencyName);
        } else if (user.role !== 'superuser') {
          // Targets are filed against the agency, not the person, so search by
          // agency_name — matching what the superuser view uses. Falls back to
          // the profile name only when the profile has no agency recorded.
          console.log('🔍 Fetching agency name from profiles table for user ID:', user.id);

          const { data, error } = await supabase
            .from('profiles')
            .select('agency_name, name')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching user profile:', error);
            agencyName = user.name || null;
          } else {
            console.log('✅ Found agency name in profiles:', data.agency_name || data.name);
            agencyName = data.agency_name || data.name || null;
          }
        }
        
        setCurrentUserName(agencyName);
        
        // Trigger refetch when agency name is set
        if (agencyName) {
          setTimeout(() => {
            console.log('🔄 Triggering manual refetch with agency name:', agencyName);
            refetchTargets();
          }, 100);
        }
      } catch (error) {
        console.error('Exception setting target agency name:', error);
        setCurrentUserName(user.name || null);
      } finally {
        setProfileLoading(false);
      }
    };

    setTargetAgencyName();
  }, [user, selectedAgencyId, agencies]);

  // Show external error if any
  useEffect(() => {
    if (externalError) {
      toast({
        title: "External Data Warning",
        description: `External data unavailable: ${externalError}`,
        variant: "destructive",
      });
    }
  }, [externalError, toast]);

  // Process and filter external targets
  const getFilteredData = () => {
    try {
      if (!externalTargets || !Array.isArray(externalTargets)) {
        console.warn('externalTargets is not an array:', externalTargets);
        return [];
      }

      const processedTargets = externalTargets.map(target => {
        try {
          if (!target) {
            console.warn('Target is null/undefined:', target);
            return null;
          }

          // Convert target_months to quarter using the service helper
          const months = ExternalDataService.getInstance().parseTargetMonths(target.target_months);
          const quarter = ExternalDataService.getInstance().monthsToQuarter(months);

          return {
            ...target,
            quarter: quarter,
            year: target.target_year || new Date().getFullYear(),
            productCategory: `External Target (${target.target_months || 'Unknown'})`,
            targetAmount: target.adjusted_total_value || target.initial_total_value || 0,
            achievedAmount: target.achievement || 0, // Use pre-calculated achievement from hook
            agencyName: target.customer_name || 'Unknown'
          };
        } catch (error) {
          console.error('Error processing external target:', error, target);
          // Return a safe fallback object
          return {
            id: target?.id || `fallback-${Math.random()}`,
            quarter: 'Q1' as const,
            year: target?.target_year || new Date().getFullYear(),
            productCategory: `External Target (Invalid Data)`,
            targetAmount: target?.adjusted_total_value || target?.initial_total_value || 0,
            achievedAmount: target?.achievement || 0,
            agencyName: target?.customer_name || 'Unknown',
            target_months: target?.target_months || 'Q1',
            customer_name: target?.customer_name || 'Unknown'
          };
        }
      }).filter(Boolean); // Remove null entries

      return processedTargets.filter(target => {
        const matchesQuarter = selectedQuarter === 'all' || target.quarter === selectedQuarter;
        const matchesYear = selectedYear === 'all' || target.year.toString() === selectedYear;
        
        return matchesQuarter && matchesYear;
      });
    } catch (error) {
      console.error('Error in getFilteredData:', error);
      return [];
    }
  };

  const filteredTargets = getFilteredData();

  // Function to toggle card expansion and fetch category data
  const toggleCardExpansion = async (cardId: string, target?: any) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
        // Fetch category breakdown when expanding
        if (target && !categoryBreakdowns.has(cardId)) {
          fetchCategoryBreakdown(cardId, target);
        }
      }
      return newSet;
    });
  };

  // Function to fetch category breakdown for a specific target
  const fetchCategoryBreakdown = async (cardId: string, target: any) => {
    try {
      console.log('🔍 Fetching category breakdown for target:', cardId);
      
      // Find the original external target data
      const originalTarget = externalTargets.find(t => 
        (t.id && t.id === target.id) || 
        `${target.quarter}-${target.year}-${target.agencyName}`.includes(cardId)
      );
      
      if (!originalTarget) {
        console.log('⚠️ Original target not found for category breakdown');
        return;
      }
      
      const breakdown = await ExternalDataService.getInstance().getCategoryBreakdown(originalTarget);
      
      setCategoryBreakdowns(prev => {
        const newMap = new Map(prev);
        newMap.set(cardId, breakdown);
        return newMap;
      });
      
      console.log('📊 Category breakdown loaded for', cardId, ':', breakdown);
      
    } catch (error) {
      console.error('Error fetching category breakdown:', error);
      // Set empty breakdown on error
      setCategoryBreakdowns(prev => {
        const newMap = new Map(prev);
        newMap.set(cardId, []);
        return newMap;
      });
    }
  };

  // Function to fetch comparison data
  const fetchComparisonData = async () => {
    // Superuser with "All agencies" selected has no single agency name — that's
    // valid and means aggregate across all agencies.
    const aggregateAllAgencies = user.role === 'superuser' && !selectedAgencyId;
    if (!user || (!currentUserName && !aggregateAllAgencies)) {
      console.log('No user name or user data available for comparison');
      return;
    }

    setComparisonLoading(true);
    try {
      console.log('🔄 Fetching comparison data for:', aggregateAllAgencies ? 'ALL AGENCIES' : currentUserName);

      const currentYear = parseInt(comparisonYear);
      const currentMonth = parseInt(comparisonMonth);
      const comparison = await ExternalDataService.getInstance().getTargetVsAchievementComparison(
        user,
        currentUserName || user.name || '',
        currentYear,
        currentMonth,
        user.role === 'superuser' ? selectedAgencyId : user.agencyId
      );
      
      setComparisonData(comparison);
      console.log('🔄 Comparison data loaded:', comparison);
      
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      setComparisonData({
        data: [],
        summary: {
          totalExternalTarget: 0,
          totalInternalAchievement: 0,
          overallAchievementPercentage: 0,
          totalGap: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setComparisonLoading(false);
    }
  };

  // Fetch comparison data when switching to comparison tab or when user/year changes
  useEffect(() => {
    const aggregateAllAgencies = user.role === 'superuser' && !selectedAgencyId;
    if (activeTab === 'comparison' && user && (currentUserName || aggregateAllAgencies)) {
      fetchComparisonData();
      fetchCompCategoryBreakdown();
    }
  }, [activeTab, currentUserName, comparisonMonth, comparisonYear, selectedAgencyId, user]);


  // Calculate summary for external targets only
  const totalTarget = filteredTargets.reduce((sum, t) => {
    return sum + (Number(t.targetAmount) || 0);
  }, 0);
  
  const totalAchieved = filteredTargets.reduce((sum, t) => {
    return sum + (Number(t.achievedAmount) || 0);
  }, 0);
  
  const achievementPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const years = [
    ...new Set([
      new Date().getFullYear(),
      ...(externalTargets || []).map(t => t.target_year).filter(Boolean)
    ])
  ].sort((a, b) => b - a);
  const comparisonMonthLabel = months.find(month => month.value === comparisonMonth)?.label || 'Selected Month';

  if (profileLoading || externalLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">
          {profileLoading ? 'Loading user profile...' : 'Loading targets...'}
        </p>
      </div>
    );
  }

  // Add error handling for rendering
  try {
    return (
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Targets Management</h2>
          <p className="text-gray-600">
            Manage and compare targets for {currentUserName || 'current user'}
          </p>
        </div>
      </div>

      {/* Agency Selector for Superusers */}
      <AgencySelector
        user={user}
        selectedAgencyId={selectedAgencyId}
        onAgencyChange={(agencyId) => {
          setSelectedAgencyId(agencyId);
        }}
        placeholder="Select agency to view targets..."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="external" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            External Targets
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Target vs Achievement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="external" className="space-y-6 mt-6">

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

      {/* External Data Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-green-600" />
          <h3 className="font-medium text-green-900">
            External Sales Targets - Sales targets from external system
          </h3>
        </div>
        <p className="text-sm text-green-700 mt-1">
          Showing {externalTargets.length} external targets filtered by user: {currentUserName || 'N/A'}
        </p>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm">Connection: {isConnected ? '✅ Connected' : '❌ Disconnected'}</span>
          {stats && (
            <>
              <span className="text-sm">Targets: {stats.targetsCount}</span>
              <span className="text-sm">Invoices: {stats.invoicesCount}</span>
            </>
          )}
        </div>
        {!externalAvailable && (
          <p className="text-sm text-orange-600 mt-1">
            ⚠️ External data service not available. Check configuration.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          setSelectedQuarter(getCurrentQuarter());
          setSelectedYear(new Date().getFullYear().toString());
        }}>
          Current Period
        </Button>
      </div>

      {/* External Targets List */}
      <div className="space-y-4">
        {filteredTargets.map((target, index) => {
          try {
            const targetAmount = Number(target.targetAmount) || 0;
            const achievedAmount = Number(target.achievedAmount) || 0;
            const progress = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;
            const isOnTrack = progress >= 75;
            const cardId = target.id || `${target.quarter}-${target.year}-${index}`;
            const isExpanded = expandedCards.has(cardId);
            
            // Get real category breakdown from state
            const categoryBreakdown = categoryBreakdowns.get(cardId) || [];
            
            return (
            <Card key={cardId}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg p-3 bg-green-100">
                      <ExternalLink className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{target.productCategory}</h3>
                        <Badge variant="outline" className="text-xs">
                          External
                        </Badge>
                      </div>
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
                  <div className="flex gap-2 items-center">
                    <Badge variant={isOnTrack ? 'default' : 'secondary'}>
                      {isOnTrack ? 'On Track' : 'Behind Target'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCardExpansion(cardId, target)}
                      className="p-2"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Target Amount</p>
                    <p className="text-xl font-semibold">Rs {targetAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Achieved</p>
                    <p className="text-xl font-semibold">Rs {achievedAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="text-xl font-semibold">{progress.toFixed(1)}%</p>
                  </div>
                </div>

                <Progress value={progress} className="h-3 mb-4" />

                {/* Expandable Category Breakdown */}
                <Collapsible open={isExpanded} onOpenChange={() => toggleCardExpansion(cardId, target)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Category Breakdown
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Performance by Category
                      </h4>
                      <div className="space-y-3">
                        {categoryBreakdown.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            <p>No category data available</p>
                            <p className="text-xs">Target data: {target.target_data ? 'Available' : 'Not available'}</p>
                          </div>
                        ) : (
                          categoryBreakdown.map((category, catIndex) => {
                            const categoryProgress = category.target > 0 ? (category.achieved / category.target) * 100 : 0;
                            return (
                            <div key={catIndex} className="bg-white rounded p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">{category.category}</span>
                                <Badge variant="outline" className="text-xs">
                                  {category.percentage.toFixed(1)}% of total
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 mb-2">
                                <div>
                                  <span className="block">Target</span>
                                  <span className="font-medium text-gray-900">Rs {category.target.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="block">Achieved</span>
                                  <span className="font-medium text-gray-900">Rs {category.achieved.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="block">Progress</span>
                                  <span className="font-medium text-gray-900">{categoryProgress.toFixed(1)}%</span>
                                </div>
                              </div>
                              <Progress value={categoryProgress} className="h-2" />
                            </div>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                        <p>* Category breakdown is estimated based on historical data patterns</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
            );
          } catch (cardError) {
            console.error('Error rendering target card:', cardError, target);
            return (
              <Card key={`error-${index}`}>
                <CardContent className="p-6">
                  <div className="text-red-600">
                    <h3>Error rendering target card</h3>
                    <p className="text-sm">{cardError instanceof Error ? cardError.message : 'Unknown error'}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }
        })}
      </div>

      {filteredTargets.length === 0 && (
        <div className="text-center py-12">
          <ExternalLink className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No external targets found</h3>
          <p className="text-gray-600">
            No external sales targets found for {currentUserName || 'current user'}. 
            {!externalAvailable && ' External data service may not be configured.'}
          </p>
        </div>
      )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">
                Target vs Achievement - {comparisonMonthLabel} {comparisonYear}
              </h3>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Achievement is calculated from internal invoice totals for the selected period.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={comparisonMonth} onValueChange={setComparisonMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={comparisonYear} onValueChange={setComparisonYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setComparisonMonth((new Date().getMonth() + 1).toString());
              setComparisonYear(new Date().getFullYear().toString());
            }}>
              Current Month
            </Button>
          </div>

          {comparisonLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading comparison data...</p>
            </div>
          ) : comparisonData?.error ? (
            <div className="text-center py-12">
              <div className="text-red-600">
                <h3 className="text-lg font-medium mb-2">Error Loading Comparison</h3>
                <p className="text-sm">{comparisonData.error}</p>
              </div>
            </div>
          ) : comparisonData ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">External Target</p>
                        <p className="text-2xl font-bold">Rs {comparisonData.summary.totalExternalTarget.toLocaleString()}</p>
                      </div>
                      <Target className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:ring-2 hover:ring-green-400 transition"
                  onClick={openAchievementInvoices}
                  title="Click to see the invoices behind this figure"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          Internal Achievement
                          <Receipt className="h-3.5 w-3.5 text-green-600" />
                        </p>
                        <p className="text-2xl font-bold">Rs {comparisonData.summary.totalInternalAchievement.toLocaleString()}</p>
                        <p className="text-[11px] text-green-700 mt-0.5">Click to view invoices</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Achievement %</p>
                        <p className="text-2xl font-bold">{comparisonData.summary.overallAchievementPercentage.toFixed(1)}%</p>
                      </div>
                      <div className="w-16">
                        <Progress value={comparisonData.summary.overallAchievementPercentage} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Gap</p>
                        <p className={`text-2xl font-bold ${
                          comparisonData.summary.totalGap >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {comparisonData.summary.totalGap >= 0 ? '+' : ''}Rs {comparisonData.summary.totalGap.toLocaleString()}
                        </p>
                      </div>
                      <GitCompare className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Comparison */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Period-wise Comparison</h3>
                {comparisonData.data.map((period, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold">{period.period}</h4>
                          <p className="text-sm text-gray-600">Target vs Achievement</p>
                        </div>
                        <Badge variant={period.achievementPercentage >= 100 ? 'default' : 'secondary'}>
                          {period.achievementPercentage >= 100 ? 'Target Achieved' : 'Below Target'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">External Target</p>
                          <p className="text-xl font-semibold">Rs {period.externalTarget.toLocaleString()}</p>
                        </div>
                        <div
                          className="cursor-pointer rounded-md -m-1 p-1 hover:bg-green-50"
                          onClick={openAchievementInvoices}
                          title="Click to see the invoices behind this figure"
                        >
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            Internal Achievement
                            <Receipt className="h-3.5 w-3.5 text-green-600" />
                          </p>
                          <p className="text-xl font-semibold underline decoration-dotted decoration-green-500">Rs {period.internalAchievement.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Achievement %</p>
                          <p className="text-xl font-semibold">{period.achievementPercentage.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Gap</p>
                          <p className={`text-xl font-semibold ${
                            period.gap >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {period.gap >= 0 ? '+' : ''}Rs {period.gap.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <Progress value={period.achievementPercentage} className="h-3" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {comparisonData.data.length === 0 && (
                <div className="text-center py-12">
                  <GitCompare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No comparison data available</h3>
                  <p className="text-gray-600">
                    No external targets found for comparison with internal sales data.
                  </p>
                </div>
              )}

              {/* Category Breakdown */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Category Breakdown — {comparisonMonthLabel} {comparisonYear}
                </h3>
                {compCategoryLoading ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading categories...</p>
                  </div>
                ) : compCategoryData.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No targets assigned for this period.</div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const total = compCategoryData.length;
                      const achieved = compCategoryData.filter(c => c.achieved >= c.target).length;
                      const pctAchieved = total > 0 ? (achieved / total) * 100 : 0;
                      return (
                        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                          <span className="text-sm font-medium text-purple-900">
                            {achieved} of {total} sub-categories achieved target
                          </span>
                          <Badge className={`${pctAchieved >= 75 ? 'bg-green-600' : pctAchieved >= 50 ? 'bg-yellow-500' : 'bg-red-500'} text-white`}>
                            {pctAchieved.toFixed(0)}%
                          </Badge>
                        </div>
                      );
                    })()}
                    {compCategoryData.map((cat) => {
                      const pct = cat.target > 0 ? Math.min((cat.achieved / cat.target) * 100, 100) : 0;
                      const gap = cat.achieved - cat.target;
                      const isOnTrack = cat.target === 0 || cat.achieved >= cat.target;
                      return (
                        <Card key={cat.category}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium text-gray-900">{cat.category}</span>
                              <Badge variant={isOnTrack ? 'default' : 'secondary'} className="text-xs">
                                {cat.target === 0 ? 'No Target' : isOnTrack ? 'On Track' : 'Below Target'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                              <div>
                                <p className="text-gray-500 text-xs">Target</p>
                                <p className="font-semibold text-gray-900">
                                  {cat.target > 0 ? `Rs ${cat.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Achieved</p>
                                <p className="font-semibold text-gray-900">Rs {cat.achieved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">{cat.target > 0 ? 'Gap' : 'Progress'}</p>
                                <p className={`font-semibold ${gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {cat.target > 0 ? `${gap >= 0 ? '+' : ''}Rs ${gap.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${pct.toFixed(0)}%`}
                                </p>
                              </div>
                            </div>
                            {cat.target > 0 && <Progress value={pct} className="h-2" />}
                          </CardContent>
                        </Card>
                      );
                    })}
                    <div className="flex justify-between text-sm text-gray-500 pt-1 px-1">
                      <span>Total Target: Rs {compCategoryData.reduce((s, c) => s + c.target, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span>Total Achieved: Rs {compCategoryData.reduce((s, c) => s + c.achieved, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <GitCompare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Target vs Achievement Comparison</h3>
              <p className="text-gray-600">
                Switch to this tab to compare external targets with internal sales achievements.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Internal Achievement drill-down: invoices behind the figure */}
      <Dialog open={showAchievementInvoices} onOpenChange={setShowAchievementInvoices}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              Invoices — {comparisonMonthLabel} {comparisonYear}
            </DialogTitle>
          </DialogHeader>
          {achievementInvoicesLoading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading invoices...</p>
            </div>
          ) : achievementInvoices.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">No invoices found for this period.</div>
          ) : (
            <div className="overflow-y-auto">
              <div className="flex justify-between text-sm font-medium text-gray-500 px-3 py-2 border-b sticky top-0 bg-white">
                <span>Invoice / Customer</span>
                <span>Value &amp; Date</span>
              </div>
              {achievementInvoices.map((inv) => {
                const d = inv.createdAt ? new Date(inv.createdAt) : null;
                return (
                  <div key={inv.id} className="flex justify-between items-start gap-4 px-3 py-2 border-b last:border-0 hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{inv.customerName}</p>
                      <p className="text-xs text-gray-500">#{inv.invoiceNumber || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">Rs {inv.total.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        {d ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between items-center px-3 py-3 mt-1 border-t-2 font-semibold text-sm">
                <span>{achievementInvoices.length} invoice(s)</span>
                <span>Rs {achievementInvoices.reduce((s, i) => s + i.total, 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    );
  } catch (error) {
    console.error('Error rendering QuarterlyTargetsManagement:', error);
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Targets</h3>
        <p className="text-red-700">There was an error loading the targets page. Please check the console for details.</p>
        <details className="mt-4">
          <summary className="cursor-pointer text-red-600">Error Details</summary>
          <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </details>
      </div>
    );
  }
};

export default QuarterlyTargetsManagement;
