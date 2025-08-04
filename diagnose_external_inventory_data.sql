-- Diagnostic script to understand why external inventory still shows data after manual deletion

-- Step 1: Check if external_inventory_management table is actually empty
SELECT 
    'external_inventory_management table check' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT product_name) as unique_products,
    COUNT(DISTINCT agency_id) as unique_agencies
FROM external_inventory_management;

-- Step 2: Check the view that the UI uses
SELECT 
    'external_inventory_stock_summary view check' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT product_name) as unique_products,
    COUNT(DISTINCT agency_id) as unique_agencies
FROM external_inventory_stock_summary;

-- Step 3: Check specific products with 'General' category
SELECT 
    'Products with General category' as check_type,
    product_name,
    category,
    sub_category,
    current_stock,
    total_stock_in,
    total_stock_out,
    transaction_count,
    agency_id
FROM external_inventory_stock_summary
WHERE category = 'General'
ORDER BY product_name;

-- Step 4: Check if there are records in external_inventory_management with General category
SELECT 
    'Raw transactions with General category' as check_type,
    product_name,
    category,
    sub_category,
    quantity,
    transaction_type,
    external_source,
    external_id,
    agency_id,
    created_at
FROM external_inventory_management
WHERE category = 'General'
ORDER BY product_name, created_at DESC;

-- Step 5: Check other potential data sources
-- Check if there are pending stock adjustments
SELECT 
    'pending_stock_adjustments' as source,
    COUNT(*) as record_count
FROM external_stock_adjustments
WHERE status = 'pending';

-- Step 6: Force refresh the view (in case it's cached)
REFRESH MATERIALIZED VIEW IF EXISTS external_inventory_stock_summary;

-- If it's a regular view, we can drop and recreate it
-- But first let's see the view definition
SELECT 
    'view_definition' as check_type,
    definition
FROM pg_views 
WHERE viewname = 'external_inventory_stock_summary';

-- Step 7: Check if there are any triggers or functions that might be creating data
SELECT 
    'triggers_on_external_inventory' as check_type,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'external_inventory_management';

-- Step 8: Check recent activity in the table
SELECT 
    'recent_activity_check' as check_type,
    transaction_type,
    external_source,
    COUNT(*) as record_count,
    MAX(created_at) as latest_created,
    MAX(updated_at) as latest_updated
FROM external_inventory_management
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY transaction_type, external_source
ORDER BY latest_created DESC;

-- Step 9: Check if the view is showing old data due to connection pooling
-- Force a connection refresh by checking current timestamp
SELECT 
    'connection_check' as check_type,
    NOW() as current_timestamp,
    version() as database_version;