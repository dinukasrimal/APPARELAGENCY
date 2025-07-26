import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Agency {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

export const useAgency = (agencyId?: string) => {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) {
      setAgency(null);
      return;
    }

    const fetchAgency = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', agencyId)
          .single();

        if (error) throw error;

        setAgency(data);
      } catch (err) {
        console.error('Error fetching agency:', err);
        setError('Failed to fetch agency information');
        setAgency(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAgency();
  }, [agencyId]);

  return { agency, loading, error };
};

export const useAgencies = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgencies = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('agencies')
          .select('*')
          .order('name');

        if (error) throw error;

        setAgencies(data || []);
      } catch (err) {
        console.error('Error fetching agencies:', err);
        setError('Failed to fetch agencies');
        setAgencies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgencies();
  }, []);

  return { agencies, loading, error };
};

// Hook to get agency name by ID (cached for performance)
export const useAgencyName = (agencyId?: string) => {
  const { agencies } = useAgencies();
  const agencyName = agencies.find(agency => agency.id === agencyId)?.name || null;
  
  return agencyName;
};