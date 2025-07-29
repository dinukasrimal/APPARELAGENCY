-- Migration: Add external_invoice transaction type to inventory_transactions
-- This allows external invoices to be used as stock IN transactions

-- Drop the existing check constraint
ALTER TABLE public.inventory_transactions 
DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

-- Add the new constraint with external_invoice included
ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN ('grn_acceptance', 'invoice_creation', 'customer_return', 'company_return', 'adjustment', 'external_invoice'));

-- Add a column to track external invoice line item details
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS external_product_name TEXT,
ADD COLUMN IF NOT EXISTS external_product_category TEXT,
ADD COLUMN IF NOT EXISTS external_invoice_id TEXT;

-- Create index on external fields for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_external_invoice 
ON public.inventory_transactions(external_invoice_id) 
WHERE transaction_type = 'external_invoice';

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_external_category 
ON public.inventory_transactions(external_product_category) 
WHERE transaction_type = 'external_invoice';

-- Add comment for documentation
COMMENT ON COLUMN public.inventory_transactions.external_product_name IS 'Original product name from external invoice (for reference and matching)';
COMMENT ON COLUMN public.inventory_transactions.external_product_category IS 'Product category from external invoice';
COMMENT ON COLUMN public.inventory_transactions.external_invoice_id IS 'Reference to external invoice ID that created this transaction';