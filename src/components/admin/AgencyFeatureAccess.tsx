import { useEffect, useState } from 'react';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Building, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AgencyFeatureAccessProps {
  user: User;
}

interface Agency {
  id: string;
  name: string;
}

interface AgencyFeatureSetting {
  agency_id: string;
  agency_name: string;
  enable_time_tracking_odometer: boolean;
  enable_fuel_expenses: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

const AgencyFeatureAccess = ({ user }: AgencyFeatureAccessProps) => {
  const [settings, setSettings] = useState<AgencyFeatureSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (agenciesError) throw agenciesError;

      const { data: settingsData, error: settingsError } = await supabase
        .from('agency_feature_access')
        .select('*');

      if (settingsError && !settingsError.message.includes('does not exist')) {
        console.warn('Error fetching feature settings:', settingsError);
      }

      if (settingsError && settingsError.message.includes('does not exist')) {
        setSettings(
          (agenciesData || []).map((agency: Agency) => ({
            agency_id: agency.id,
            agency_name: agency.name,
            enable_time_tracking_odometer: false,
            enable_fuel_expenses: false,
          }))
        );
        toast({
          title: 'Database Setup Required',
          description: 'Please run database_setup/create_agency_feature_access_and_expenses.sql in your Supabase SQL editor.',
          variant: 'destructive',
        });
        return;
      }

      const agencies: Agency[] = agenciesData || [];
      const existingSettings: AgencyFeatureSetting[] = settingsData || [];

      const merged = agencies.map((agency) => {
        const existing = existingSettings.find((row) => row.agency_id === agency.id);
        return {
          agency_id: agency.id,
          agency_name: agency.name,
          enable_time_tracking_odometer: existing?.enable_time_tracking_odometer ?? false,
          enable_fuel_expenses: existing?.enable_fuel_expenses ?? false,
          updated_at: existing?.updated_at ?? null,
          updated_by: existing?.updated_by ?? null,
        };
      });

      setSettings(merged);
    } catch (error) {
      console.error('Error fetching feature access data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agency feature access settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (
    agencyId: string,
    nextValues: Partial<Pick<AgencyFeatureSetting, 'enable_time_tracking_odometer' | 'enable_fuel_expenses'>>
  ) => {
    try {
      setSaving(agencyId);

      const { error } = await supabase
        .from('agency_feature_access')
        .upsert(
          {
            agency_id: agencyId,
            ...nextValues,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: 'agency_id' }
        );

      if (error) throw error;

      setSettings((prev) =>
        prev.map((row) =>
          row.agency_id === agencyId
            ? { ...row, ...nextValues, updated_at: new Date().toISOString(), updated_by: user.id }
            : row
        )
      );

      toast({
        title: 'Success',
        description: 'Agency access updated.',
      });
    } catch (error) {
      console.error('Error updating agency feature access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update agency access.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="bg-white/90 border border-white/20 shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800">
            <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
              <Settings2 className="h-6 w-6 text-blue-600" />
            </div>
            Agency Feature Access
          </CardTitle>
          <p className="text-sm text-slate-600">
            Enable odometer capture and fuel/expense logging for selected agencies.
          </p>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="text-slate-600 text-center py-8">No agencies found.</div>
          ) : (
            <div className="space-y-4">
              {settings.map((row) => (
                <div
                  key={row.agency_id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-white/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center">
                      <Building className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{row.agency_name}</p>
                      <div className="flex gap-2 mt-1">
                        {row.enable_time_tracking_odometer && (
                          <Badge variant="secondary">Odometer</Badge>
                        )}
                        {row.enable_fuel_expenses && (
                          <Badge variant="secondary">Fuel & Expenses</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <Switch
                        checked={row.enable_time_tracking_odometer}
                        onCheckedChange={(checked) =>
                          updateSetting(row.agency_id, { enable_time_tracking_odometer: checked })
                        }
                        disabled={saving === row.agency_id}
                      />
                      Odometer on Clock In
                    </label>
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <Switch
                        checked={row.enable_fuel_expenses}
                        onCheckedChange={(checked) =>
                          updateSetting(row.agency_id, { enable_fuel_expenses: checked })
                        }
                        disabled={saving === row.agency_id}
                      />
                      Fuel & Expenses Module
                    </label>
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

export default AgencyFeatureAccess;
