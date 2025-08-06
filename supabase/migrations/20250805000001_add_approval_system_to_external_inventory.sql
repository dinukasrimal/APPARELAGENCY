-- Add approval system columns to external_inventory_management table
-- This enables single-table approval workflow for stock adjustments

-- Add new columns for approval system
ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (
    approval_status IN ('pending', 'approved', 'rejected')
);

ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS matched_product_id UUID;

ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS requested_by UUID;

ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS requested_by_name VARCHAR(255);

ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS approved_by UUID;

ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);

ALTER TABLE public.external_inventory_management 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Add foreign key constraint for matched_product_id
ALTER TABLE public.external_inventory_management 
ADD CONSTRAINT fk_external_inv_matched_product 
FOREIGN KEY (matched_product_id) REFERENCES public.products(id);

-- Add foreign key constraints for user references
ALTER TABLE public.external_inventory_management 
ADD CONSTRAINT fk_external_inv_requested_by 
FOREIGN KEY (requested_by) REFERENCES public.profiles(id);

ALTER TABLE public.external_inventory_management 
ADD CONSTRAINT fk_external_inv_approved_by 
FOREIGN KEY (approved_by) REFERENCES public.profiles(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ext_inv_approval_status 
ON public.external_inventory_management(approval_status);

CREATE INDEX IF NOT EXISTS idx_ext_inv_matched_product_id 
ON public.external_inventory_management(matched_product_id);

CREATE INDEX IF NOT EXISTS idx_ext_inv_requested_by 
ON public.external_inventory_management(requested_by);

CREATE INDEX IF NOT EXISTS idx_ext_inv_approved_by 
ON public.external_inventory_management(approved_by);

-- Create composite index for stock calculations (most important query)
CREATE INDEX IF NOT EXISTS idx_ext_inv_stock_calc 
ON public.external_inventory_management(agency_id, product_name, color, size, approval_status);

-- Update existing records to have approved status (they were already active)
UPDATE public.external_inventory_management 
SET approval_status = 'approved' 
WHERE approval_status IS NULL;

-- Add comment to document the approval system
COMMENT ON COLUMN public.external_inventory_management.approval_status IS 
'Approval status for stock adjustments: pending (awaiting approval), approved (active in stock), rejected (declined)';

COMMENT ON COLUMN public.external_inventory_management.matched_product_id IS 
'Foreign key to products table for proper product matching and linking';

-- Create view for approved transactions only (for performance)
CREATE OR REPLACE VIEW public.external_inventory_approved AS
SELECT * FROM public.external_inventory_management 
WHERE approval_status = 'approved';

-- Create view for pending approvals
CREATE OR REPLACE VIEW public.external_inventory_pending AS
SELECT * FROM public.external_inventory_management 
WHERE approval_status = 'pending'
ORDER BY created_at DESC;