import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgencyFeatureAccess {
  enableTimeTrackingOdometer: boolean;
  enableFuelExpenses: boolean;
}

const DEFAULT_FEATURES: AgencyFeatureAccess = {
  enableTimeTrackingOdometer: false,
  enableFuelExpenses: false,
};

export const useAgencyFeatureAccess = (agencyId?: string | null) => {
  const [features, setFeatures] = useState<AgencyFeatureAccess>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) {
      setFeatures(DEFAULT_FEATURES);
      setError(null);
      return;
    }

    const fetchFeatures = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('agency_feature_access')
          .select('enable_time_tracking_odometer, enable_fuel_expenses')
          .eq('agency_id', agencyId)
          .maybeSingle();

        if (error && !error.message.includes('does not exist')) {
          throw error;
        }

        setFeatures({
          enableTimeTrackingOdometer: data?.enable_time_tracking_odometer ?? false,
          enableFuelExpenses: data?.enable_fuel_expenses ?? false,
        });
      } catch (err) {
        console.error('Error fetching agency feature access:', err);
        setError('Failed to fetch agency feature access');
        setFeatures(DEFAULT_FEATURES);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [agencyId]);

  return { features, loading, error };
};
