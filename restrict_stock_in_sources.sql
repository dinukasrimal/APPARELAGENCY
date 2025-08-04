-- Script to restrict stock IN to only external invoices and customer returns

-- Step 1: Check current stock IN sources
SELECT 
    'Current Stock IN Sources' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_stock_in,
    COUNT(DISTINCT product_name) as unique_products
FROM external_inventory_management
WHERE quantity > 0  -- Only positive quantities (stock IN)
GROUP BY transaction_type, external_source
ORDER BY total_stock_in DESC;

-- Step 2: Identify unwanted stock IN transactions
SELECT 
    'Unwanted Stock IN Transactions' as info,
    transaction_type,
    external_source,
    COUNT(*) as count_to_remove,
    SUM(quantity) as stock_to_remove
FROM external_inventory_management
WHERE quantity > 0  -- Stock IN
  AND transaction_type NOT IN ('external_invoice', 'customer_return')
GROUP BY transaction_type, external_source;

-- Step 3: Show specific records that will be affected
SELECT 
    'Records to be removed' as info,
    id,
    product_name,
    transaction_type,
    quantity,
    external_source,
    reference_name,
    created_at
FROM external_inventory_management
WHERE quantity > 0  -- Stock IN
  AND transaction_type NOT IN ('external_invoice', 'customer_return')
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: CREATE BACKUP before making changes
CREATE TABLE IF NOT EXISTS external_inventory_backup_before_restriction AS
SELECT * FROM external_inventory_management;

-- Step 5: Remove unwanted stock IN transactions
-- This removes adjustments, GRNs, and any other unwanted stock IN sources
DELETE FROM external_inventory_management
WHERE quantity > 0  -- Only positive quantities (stock IN)
  AND transaction_type NOT IN ('external_invoice', 'customer_return');

-- Step 6: Verify only desired stock IN sources remain
SELECT 
    'After Cleanup - Remaining Stock IN Sources' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_stock_in
FROM external_inventory_management
WHERE quantity > 0  -- Only stock IN
GROUP BY transaction_type, external_source
ORDER BY total_stock_in DESC;

-- Step 7: Update database constraints to prevent future unwanted stock IN
-- Modify the check constraint to be more restrictive
ALTER TABLE external_inventory_management 
DROP CONSTRAINT IF EXISTS external_inventory_management_transaction_type_check;

-- Add new constraint that prevents unwanted stock IN types
ALTER TABLE external_inventory_management 
ADD CONSTRAINT external_inventory_management_transaction_type_check 
CHECK (
    transaction_type IN (
        'external_invoice',  -- Stock IN: Only from external bot
        'customer_return',   -- Stock IN: Only from customer returns
        'sale',             -- Stock OUT: Customer sales (negative quantity)
        'company_return'    -- Stock OUT: Company returns (negative quantity)
    )
);

-- Note: This removes 'grn' and 'adjustment' entirely
-- If adjustments are needed, they should go through a different process

-- Step 8: Update the database comment
COMMENT ON COLUMN public.external_inventory_management.transaction_type IS 
'Type of inventory transaction: external_invoice (stock IN), customer_return (stock IN), sale (stock OUT), company_return (stock OUT)';

-- Step 9: Disable the approval function that creates adjustment transactions
-- You may need to modify the approve_external_stock_adjustment function
-- to NOT create inventory transactions, or modify it to only allow negative adjustments

-- Step 10: Final verification
SELECT 
    'Final Stock Summary' as info,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
    SUM(quantity) as net_stock
FROM external_inventory_management;

COMMIT;