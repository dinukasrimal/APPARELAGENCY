import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/auth';

interface DiscountLimit {
  id: string;
  agency_id: string;
  max_discount_percentage: number;
  is_active: boolean;
}

export const useDiscountValidation = (user: User) => {
  const [agencyDiscountLimit, setAgencyDiscountLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiscountLimit = async () => {
      if (user.role === 'superuser') {
        // Superusers have no discount limits
        setAgencyDiscountLimit(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('agency_discount_limits')
          .select('max_discount_percentage')
          .eq('agency_id', user.agencyId)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error fetching discount limit:', error);
          // Default to 0% if no limit is set or error occurs
          setAgencyDiscountLimit(0);
        } else {
          // Set the limit, or default to 0% if no limit is configured
          setAgencyDiscountLimit(data ? data.max_discount_percentage : 0);
        }
      } catch (error) {
        console.error('Error fetching discount limit:', error);
        setAgencyDiscountLimit(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscountLimit();
  }, [user.agencyId, user.role]);

  const validateDiscount = (discountPercentage: number): {
    isValid: boolean;
    requiresApproval: boolean;
    message?: string;
  } => {
    if (user.role === 'superuser') {
      return {
        isValid: true,
        requiresApproval: false,
      };
    }

    if (agencyDiscountLimit === null || loading) {
      // Still loading or no limit set, allow up to 20% (legacy behavior)
      return {
        isValid: true,
        requiresApproval: discountPercentage > 20,
        message: discountPercentage > 20 ? 'Discount exceeds 20% and requires approval' : undefined,
      };
    }

    if (discountPercentage <= agencyDiscountLimit) {
      return {
        isValid: true,
        requiresApproval: false,
      };
    }

    return {
      isValid: true,
      requiresApproval: true,
      message: `Discount exceeds your limit of ${agencyDiscountLimit}% and requires superuser approval`,
    };
  };

  return {
    agencyDiscountLimit,
    loading,
    validateDiscount,
  };
};