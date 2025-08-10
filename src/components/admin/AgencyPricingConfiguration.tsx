import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Building, DollarSign, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AgencyPricingConfigurationProps {
  user: User;
  onBack: () => void;
}

interface Agency {
  id: string;
  name: string;
}

interface AgencyPricingSetting {
  agency_id: string;
  agency_name: string;
  price_type: 'selling_price' | 'billing_price';
  updated_at?: string;
  updated_by?: string;
}

const AgencyPricingConfiguration = ({ user, onBack }: AgencyPricingConfigurationProps) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [pricingSettings, setPricingSettings] = useState<AgencyPricingSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // Track which agency is being saved
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch agencies
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (agenciesError) throw agenciesError;

      // Fetch existing pricing settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('agency_pricing_settings')
        .select('*');

      // Don't throw error if table doesn't exist yet
      if (settingsError && !settingsError.message.includes('does not exist')) {
        console.warn('Error fetching pricing settings:', settingsError);
      }
      
      // If table doesn't exist, show setup message
      if (settingsError && settingsError.message.includes('does not exist')) {
        setAgencies(agenciesData || []);
        setPricingSettings([]);
        setLoading(false);
        toast({
          title: "Database Setup Required",
          description: "Please run the SQL script from database_setup/create_agency_pricing_settings_table.sql in your Supabase SQL editor.",
          variant: "destructive",
        });
        return;
      }

      const agencies: Agency[] = agenciesData || [];
      const settings: AgencyPricingSetting[] = settingsData || [];

      // Create pricing settings array with all agencies
      const pricingSettings: AgencyPricingSetting[] = agencies.map(agency => {
        const existingSetting = settings.find(s => s.agency_id === agency.id);
        return {
          agency_id: agency.id,
          agency_name: agency.name,
          price_type: existingSetting?.price_type || 'billing_price', // Default to billing_price
          updated_at: existingSetting?.updated_at,
          updated_by: existingSetting?.updated_by
        };
      });

      setAgencies(agencies);
      setPricingSettings(pricingSettings);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch agencies and pricing settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePricingSettings = async (agencyId: string, priceType: 'selling_price' | 'billing_price') => {
    try {
      setSaving(agencyId);

      // First, check if the table exists
      const tableExists = await createPricingSettingsTableIfNotExists();
      if (!tableExists) {
        return; // Exit if table doesn't exist
      }

      // Update or insert the pricing setting
      const { error } = await supabase
        .from('agency_pricing_settings')
        .upsert({
          agency_id: agencyId,
          price_type: priceType,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        }, {
          onConflict: 'agency_id'
        });

      if (error) throw error;

      // Update local state
      setPricingSettings(prev => 
        prev.map(setting => 
          setting.agency_id === agencyId 
            ? { ...setting, price_type: priceType, updated_at: new Date().toISOString(), updated_by: user.id }
            : setting
        )
      );

      toast({
        title: "Success",
        description: "Pricing configuration updated successfully",
      });

    } catch (error) {
      console.error('Error updating pricing settings:', error);
      toast({
        title: "Error",
        description: "Failed to update pricing configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const createPricingSettingsTableIfNotExists = async () => {
    // Since RPC is not available, we'll use a simpler approach
    // Try to query the table first to see if it exists
    const { data, error } = await supabase
      .from('agency_pricing_settings')
      .select('id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      // Table doesn't exist, we need to create it manually
      // For now, we'll show an informative message to the user
      console.warn('agency_pricing_settings table does not exist. Please create it manually.');
      toast({
        title: "Database Setup Required",
        description: "The pricing settings table needs to be created. Please contact your database administrator.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const getPriceTypeLabel = (priceType: string) => {
    switch (priceType) {
      case 'selling_price':
        return 'Selling Price';
      case 'billing_price':
        return 'Billing Price';
      default:
        return 'Unknown';
    }
  };

  const getPriceTypeBadgeVariant = (priceType: string) => {
    switch (priceType) {
      case 'selling_price':
        return 'default' as const;
      case 'billing_price':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Agency Pricing Configuration</h1>
          <p className="text-gray-600">Configure which price type each agency uses in sales module</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Pricing Configuration Rules:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• <strong>Selling Price:</strong> Shows selling price in sales module (higher price for customers)</li>
                <li>• <strong>Billing Price:</strong> Shows billing price in sales module (lower cost price)</li>
                <li>• <strong>Default:</strong> Billing price is used if no configuration is set</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agency Pricing Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pricingSettings.map((setting) => (
          <Card key={setting.agency_id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5 text-gray-600" />
                {setting.agency_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Setting:</span>
                <Badge variant={getPriceTypeBadgeVariant(setting.price_type)}>
                  {getPriceTypeLabel(setting.price_type)}
                </Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Price Type for Sales:</label>
                <Select
                  value={setting.price_type}
                  onValueChange={(value) => updatePricingSettings(setting.agency_id, value as 'selling_price' | 'billing_price')}
                  disabled={saving === setting.agency_id}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing_price">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        Billing Price (Cost)
                      </div>
                    </SelectItem>
                    <SelectItem value="selling_price">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Selling Price (Customer)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {setting.updated_at && (
                <div className="text-xs text-gray-500 pt-2 border-t">
                  Last updated: {new Date(setting.updated_at).toLocaleDateString()}
                </div>
              )}

              {saving === setting.agency_id && (
                <div className="flex items-center justify-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Saving...</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pricingSettings.length === 0 && agencies.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Agencies Found</h3>
            <p className="text-gray-600">No agencies are available to configure pricing settings.</p>
          </CardContent>
        </Card>
      )}

      {pricingSettings.length === 0 && agencies.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-8 text-center">
            <Settings className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-orange-900 mb-2">Database Setup Required</h3>
            <p className="text-orange-700 mb-4">
              The agency pricing settings table needs to be created before you can configure pricing preferences.
            </p>
            <div className="bg-white p-4 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800 font-medium mb-2">Instructions:</p>
              <ol className="text-sm text-orange-700 text-left list-decimal list-inside space-y-1">
                <li>Open your Supabase dashboard</li>
                <li>Go to the SQL Editor</li>
                <li>Run the script from: <code className="bg-orange-100 px-2 py-1 rounded text-xs">database_setup/create_agency_pricing_settings_table.sql</code></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgencyPricingConfiguration;