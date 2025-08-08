-- Add secondary phone number field to customers table
-- Migration: Add optional secondary_phone field for additional customer contact

ALTER TABLE public.customers 
ADD COLUMN secondary_phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.secondary_phone IS 'Optional secondary phone number for the customer (e.g., alternate contact number)';

-- Note: Field is intentionally nullable to maintain backward compatibility
-- No constraints added since this is an optional field