-- Add original_external_id column to store string IDs from external system
ALTER TABLE public.external_bot_project_invoices 
ADD COLUMN IF NOT EXISTS original_external_id VARCHAR(255);

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_original_external_id 
ON public.external_bot_project_invoices(original_external_id);

-- Add comment
COMMENT ON COLUMN public.external_bot_project_invoices.original_external_id 
IS 'Original external ID from source system (may be string format like INV/2025/00614)';