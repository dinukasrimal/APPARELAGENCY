-- Script to switch from external database sync to local external_bot_project_invoices

-- Step 1: Check current external database data
SELECT 
    'Current external database sync data' as info,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity,
    COUNT(DISTINCT product_name) as unique_products,
    COUNT(DISTINCT external_id) as unique_invoices
FROM external_inventory_management
WHERE external_source = 'bot'
   OR transaction_type = 'external_invoice'
GROUP BY external_source;

-- Step 2: Check what's in local external_bot_project_invoices table
SELECT 
    'Local external_bot_project_invoices data' as info,
    COUNT(*) as total_invoices,
    COUNT(DISTINCT partner_name) as unique_partners,
    MIN(date_order) as earliest_invoice,
    MAX(date_order) as latest_invoice,
    SUM(amount_total) as total_amount
FROM external_bot_project_invoices;

-- Step 3: Show sample data from local invoices
SELECT 
    'Sample local invoices' as info,
    id,
    name as invoice_number,
    partner_name,
    date_order,
    amount_total,
    state,
    CASE 
        WHEN order_lines IS NOT NULL THEN jsonb_array_length(order_lines)
        ELSE 0
    END as order_lines_count
FROM external_bot_project_invoices
ORDER BY date_order DESC
LIMIT 10;

-- Step 4: Create backup of external database sync data
CREATE TABLE IF NOT EXISTS external_db_sync_backup AS
SELECT * FROM external_inventory_management
WHERE external_source = 'bot'
   OR (transaction_type = 'external_invoice' AND external_source != 'local_bot');

-- Step 5: Remove external database sync data
DELETE FROM external_inventory_management
WHERE external_source = 'bot'
   OR (transaction_type = 'external_invoice' AND external_source != 'local_bot');

-- Step 6: Update the external_source constraint to include 'local_bot'
-- First check if there's an existing constraint on external_source
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'external_inventory_management'::regclass
  AND pg_get_constraintdef(oid) LIKE '%external_source%';

-- Step 7: Re-enable external_invoice transaction type for local use
ALTER TABLE external_inventory_management 
DROP CONSTRAINT IF EXISTS external_inventory_management_transaction_type_check;

-- Add constraint that allows external_invoice from local sources
ALTER TABLE external_inventory_management 
ADD CONSTRAINT external_inventory_management_transaction_type_check 
CHECK (
    transaction_type IN (
        'external_invoice',  -- Stock IN: External invoices from LOCAL table
        'customer_return',   -- Stock IN: Customer returns
        'adjustment',        -- Stock IN/OUT: Manual adjustments
        'sale',             -- Stock OUT: Customer sales
        'company_return'    -- Stock OUT: Company returns
    )
);

-- Step 8: Update comments
COMMENT ON COLUMN public.external_inventory_management.transaction_type IS 
'Type of inventory transaction: external_invoice (from local external_bot_project_invoices), customer_return, adjustment, sale, company_return';

COMMENT ON COLUMN public.external_inventory_management.external_source IS 
'Source of the transaction: local_bot (from external_bot_project_invoices), manual, approval, etc.';

-- Step 9: Verify the cleanup
SELECT 
    'After cleanup - remaining data' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity
FROM external_inventory_management
GROUP BY transaction_type, external_source
ORDER BY transaction_count DESC;

-- Step 10: Check current stock summary after cleanup
SELECT 
    'Stock summary after switch to local' as info,
    COUNT(DISTINCT product_name) as unique_products,
    SUM(CASE WHEN current_stock > 0 THEN current_stock ELSE 0 END) as total_stock
FROM external_inventory_stock_summary;

-- Step 11: Verify BBL product is gone (it was from external database)
SELECT 
    'BBL product check' as info,
    product_name,
    current_stock
FROM external_inventory_stock_summary
WHERE product_name ILIKE '%BBL%'
   OR product_code = 'BBL';

COMMIT;