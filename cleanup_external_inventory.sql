-- Script to completely clean up external inventory data

-- Step 1: Check what's currently in the table
SELECT 
    'Current records in external_inventory_management' as info,
    COUNT(*) as total_records,
    COUNT(DISTINCT product_name) as unique_products,
    COUNT(DISTINCT agency_id) as agencies,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM external_inventory_management;

-- Step 2: Show breakdown by source and transaction type
SELECT 
    'Records by source and type' as info,
    external_source,
    transaction_type,
    COUNT(*) as record_count,
    SUM(quantity) as total_quantity
FROM external_inventory_management
GROUP BY external_source, transaction_type
ORDER BY external_source, transaction_type;

-- Step 3: Show records by agency (in case you want to keep some agencies)
SELECT 
    'Records by agency' as info,
    agency_id,
    COUNT(*) as record_count,
    COUNT(DISTINCT product_name) as unique_products,
    SUM(quantity) as total_stock
FROM external_inventory_management
GROUP BY agency_id
ORDER BY agency_id;

-- Step 4: COMPLETE CLEANUP - Delete ALL records from external_inventory_management
-- Uncomment the line below if you want to delete everything:
-- DELETE FROM external_inventory_management;

-- Step 5: Or delete only for specific agency (replace 'your-agency-id' with actual agency ID)
-- DELETE FROM external_inventory_management WHERE agency_id = 'your-agency-id';

-- Step 6: Or delete only records with 'General' category
-- DELETE FROM external_inventory_management WHERE category = 'General';

-- Step 7: Or delete only bot-imported records
-- DELETE FROM external_inventory_management WHERE external_source = 'bot';

-- Step 8: After deletion, verify the table is empty
SELECT 
    'After cleanup verification' as info,
    COUNT(*) as remaining_records
FROM external_inventory_management;

-- Step 9: Verify the view now shows no data
SELECT 
    'View after cleanup' as info,
    COUNT(*) as remaining_in_view
FROM external_inventory_stock_summary;