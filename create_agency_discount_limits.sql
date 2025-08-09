-- Create agency_discount_limits table to store superuser-assigned discount percentages

CREATE TABLE IF NOT EXISTS public.agency_discount_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  max_discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (max_discount_percentage >= 0 AND max_discount_percentage <= 100),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agency_discount_limits_agency_id ON public.agency_discount_limits(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_discount_limits_active ON public.agency_discount_limits(is_active);

-- Create partial unique index to ensure only one active discount limit per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_agency_discount 
  ON public.agency_discount_limits(agency_id) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.agency_discount_limits ENABLE ROW LEVEL SECURITY;

-- Allow superusers to manage all discount limits
CREATE POLICY "Superusers can manage all discount limits"
  ON public.agency_discount_limits
  FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  );

-- Allow agencies to view their own discount limits
CREATE POLICY "Agencies can view their own discount limits"
  ON public.agency_discount_limits
  FOR SELECT
  USING (
    agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_agency_discount_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agency_discount_limits_updated_at
  BEFORE UPDATE ON public.agency_discount_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agency_discount_limits_updated_at();

-- Insert comment
COMMENT ON TABLE public.agency_discount_limits IS 'Stores maximum discount percentages that can be applied by each agency without superuser approval';
COMMENT ON COLUMN public.agency_discount_limits.max_discount_percentage IS 'Maximum discount percentage (0-100) that agency can apply without approval';
COMMENT ON COLUMN public.agency_discount_limits.assigned_by IS 'Superuser who assigned this discount limit';
COMMENT ON COLUMN public.agency_discount_limits.notes IS 'Optional notes about why this discount limit was set';