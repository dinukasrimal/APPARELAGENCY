import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, TrendingUp, Calendar, Building2, ExternalLink, ChevronDown, ChevronRight, BarChart3, GitCompare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useExternalTargetsWithAchievements, useExternalConnection } from '@/hooks/useExternalData';
import { ExternalDataService } from '@/services/external-data.service';
import { supabase } from '@/integrations/supabase/client';
import AgencySelector from '@/components/common/AgencySelector';
import { useAgencies } from '@/hooks/useAgency';

interface QuarterlyTargetsManagementProps {
  user: User;
}

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
  const [activeTab, setActiveTab] = useState('external');
  
  // Filter states for external targets only
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  
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
          // For regular users, get their agency name via profile
          console.log('🔍 Fetching user name from profiles table for user ID:', user.id);
          
          const { data, error } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();
            
          if (error) {
            console.error('Error fetching user profile:', error);
            agencyName = user.name || null;
          } else {
            console.log('✅ Found user name in profiles:', data.name);
            agencyName = data.name || null;
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
    if (!currentUserName || !user) {
      console.log('No user name or user data available for comparison');
      return;
    }

    setComparisonLoading(true);
    try {
      console.log('🔄 Fetching comparison data for:', currentUserName);
      
      const currentYear = selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear);
      const comparison = await ExternalDataService.getInstance().getTargetVsAchievementComparison(
        user,
        currentUserName,
        currentYear
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
    if (activeTab === 'comparison' && currentUserName && user) {
      fetchComparisonData();
    }
  }, [activeTab, currentUserName, selectedYear, user]);


  // Calculate summary for external targets only
  const totalTarget = filteredTargets.reduce((sum, t) => {
    return sum + (Number(t.targetAmount) || 0);
  }, 0);
  
  const totalAchieved = filteredTargets.reduce((sum, t) => {
    return sum + (Number(t.achievedAmount) || 0);
  }, 0);
  
  const achievementPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const years = [...new Set((externalTargets || []).map(t => t.target_year).filter(Boolean))].sort((a, b) => b - a);

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
          setSelectedQuarter('all');
          setSelectedYear('all');
        }}>
          Clear Filters
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

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Internal Achievement</p>
                        <p className="text-2xl font-bold">Rs {comparisonData.summary.totalInternalAchievement.toLocaleString()}</p>
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
                        <div>
                          <p className="text-sm text-gray-600">Internal Achievement</p>
                          <p className="text-xl font-semibold">Rs {period.internalAchievement.toLocaleString()}</p>
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