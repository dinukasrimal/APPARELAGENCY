-- Script to remove all external database sync data and disable the functionality

-- Step 1: Check what data came from external database sync
SELECT 
    'Data from external database sync' as info,
    external_source,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity,
    COUNT(DISTINCT product_name) as unique_products,
    MIN(created_at) as first_sync,
    MAX(created_at) as last_sync
FROM external_inventory_management
WHERE external_source = 'bot'
   OR external_id IS NOT NULL
GROUP BY external_source, transaction_type;

-- Step 2: Show specific products that will be removed
SELECT 
    'Products to be removed from external sync' as info,
    product_name,
    product_code,
    SUM(quantity) as current_stock,
    COUNT(*) as transaction_count
FROM external_inventory_management
WHERE external_source = 'bot'
   OR (transaction_type = 'external_invoice' AND external_source != 'manual')
GROUP BY product_name, product_code
ORDER BY current_stock DESC
LIMIT 20;

-- Step 3: Create backup before deletion
CREATE TABLE IF NOT EXISTS external_sync_backup AS
SELECT * FROM external_inventory_management
WHERE external_source = 'bot'
   OR (transaction_type = 'external_invoice' AND external_source != 'manual');

-- Step 4: Remove all data from external database sync
DELETE FROM external_inventory_management
WHERE external_source = 'bot'
   OR (transaction_type = 'external_invoice' AND external_source != 'manual');

-- Step 5: Update transaction type constraints to exclude external_invoice
-- Since you don't want data from external sources, remove external_invoice type
ALTER TABLE external_inventory_management 
DROP CONSTRAINT IF EXISTS external_inventory_management_transaction_type_check;

-- New constraint without external_invoice
ALTER TABLE external_inventory_management 
ADD CONSTRAINT external_inventory_management_transaction_type_check 
CHECK (
    transaction_type IN (
        'customer_return',   -- Stock IN: Customer returns only
        'adjustment',        -- Stock IN/OUT: Manual adjustments
        'sale',             -- Stock OUT: Customer sales
        'company_return'    -- Stock OUT: Company returns
    )
);

-- Step 6: Update database comments
COMMENT ON COLUMN public.external_inventory_management.transaction_type IS 
'Type of inventory transaction: customer_return (stock IN), adjustment (stock IN/OUT), sale (stock OUT), company_return (stock OUT). External invoices disabled.';

-- Step 7: Verify removal
SELECT 
    'After removal - remaining data' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity
FROM external_inventory_management
GROUP BY transaction_type, external_source
ORDER BY transaction_count DESC;

-- Step 8: Check current stock summary after removal
SELECT 
    'Stock summary after external sync removal' as info,
    COUNT(DISTINCT product_name) as unique_products,
    SUM(CASE WHEN current_stock > 0 THEN current_stock ELSE 0 END) as total_stock,
    COUNT(*) as total_product_variants
FROM external_inventory_stock_summary;

-- Step 9: Check if BBL product still exists
SELECT 
    'BBL product after cleanup' as info,
    product_name,
    current_stock
FROM external_inventory_stock_summary
WHERE product_name ILIKE '%BBL%'
   OR product_code = 'BBL';

COMMIT;