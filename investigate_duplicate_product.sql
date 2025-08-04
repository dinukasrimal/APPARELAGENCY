-- SQL queries to investigate duplicate entries for "[BB2XL] BRITNY-BLACK 2XL"
-- Run these queries to diagnose why this product appears in both "OTHER" and "BRITNY" categories

-- Query 1: Check all entries for this specific product across all tables
-- Look in external_inventory_management table for all transactions
SELECT 
    product_name,
    product_code,
    color,
    size,
    category,
    sub_category,
    transaction_type,
    quantity,
    reference_name,
    transaction_date,
    external_source,
    external_id,
    notes,
    created_at,
    agency_id
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' 
   AND size = '2XL'
ORDER BY transaction_date DESC, created_at DESC;

-- Query 2: Check the stock summary view for this product
SELECT 
    product_name,
    product_code,
    color,
    size,
    category,
    sub_category,
    current_stock,
    total_stock_in,
    total_stock_out,
    transaction_count,
    last_transaction_date,
    first_transaction_date,
    agency_id
FROM public.external_inventory_stock_summary 
WHERE product_name ILIKE '%BRITNY-BLACK%' 
   AND size = '2XL';

-- Query 3: Check for different category assignments for the same product
-- This will show if the same product (name, color, size) has different categories
SELECT 
    product_name,
    color,
    size,
    category,
    COUNT(*) as transaction_count,
    SUM(quantity) as net_quantity,
    MIN(transaction_date) as first_transaction,
    MAX(transaction_date) as last_transaction,
    array_agg(DISTINCT external_source) as sources,
    array_agg(DISTINCT reference_name) as references
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' 
   AND size = '2XL'
GROUP BY product_name, color, size, category
ORDER BY product_name, color, size, category;

-- Query 4: Check for variations in product naming or attributes
-- Look for similar products that might be causing confusion
SELECT 
    product_name,
    product_code,
    color,
    size,
    category,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity
FROM public.external_inventory_management 
WHERE (
    product_name ILIKE '%BRITNY%' 
    OR product_name ILIKE '%BB2XL%'
    OR product_code ILIKE '%BB2XL%'
) 
AND size = '2XL'
GROUP BY product_name, product_code, color, size, category
ORDER BY product_name, color, size;

-- Query 5: Check the category derivation logic
-- See how categories are being assigned by external source
SELECT 
    external_source,
    category,
    sub_category,
    COUNT(*) as count,
    array_agg(DISTINCT product_name) as product_names
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY%'
GROUP BY external_source, category, sub_category
ORDER BY external_source, category;

-- Query 6: Look for any manual adjustments or corrections
-- Check if there were manual category changes
SELECT 
    product_name,
    product_code,
    color,
    size,
    category,
    transaction_type,
    quantity,
    reference_name,
    user_name,
    transaction_date,
    notes,
    external_source
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' 
   AND size = '2XL'
   AND (
       transaction_type = 'adjustment' 
       OR external_source = 'manual'
       OR notes ILIKE '%category%'
       OR notes ILIKE '%correction%'
   )
ORDER BY transaction_date DESC;

-- Query 7: Check for potential data entry inconsistencies
-- Look for the exact product with different category values
SELECT 
    product_name,
    color,
    size,
    category,
    COUNT(*) as occurrences,
    SUM(quantity) as total_quantity,
    array_agg(DISTINCT transaction_id) as transaction_ids,
    array_agg(DISTINCT external_source) as sources,
    MIN(transaction_date) as first_seen,
    MAX(transaction_date) as last_seen
FROM public.external_inventory_management 
WHERE LOWER(TRIM(product_name)) = LOWER(TRIM('[BB2XL] BRITNY-BLACK'))
   AND LOWER(TRIM(size)) = LOWER(TRIM('2XL'))
GROUP BY product_name, color, size, category
HAVING COUNT(*) > 0
ORDER BY category, total_quantity DESC;

-- Query 8: Analyze the category assignment pattern
-- Check if there's a pattern in how categories are assigned
WITH product_categories AS (
    SELECT 
        product_name,
        color,
        size,
        category,
        external_source,
        COUNT(*) as transaction_count,
        MIN(transaction_date) as first_transaction,
        MAX(transaction_date) as last_transaction
    FROM public.external_inventory_management 
    WHERE product_name ILIKE '%BRITNY-BLACK%' AND size = '2XL'
    GROUP BY product_name, color, size, category, external_source
)
SELECT 
    product_name,
    color,
    size,
    STRING_AGG(DISTINCT category, ', ') as all_categories,
    STRING_AGG(DISTINCT external_source, ', ') as all_sources,
    COUNT(DISTINCT category) as category_count,
    SUM(transaction_count) as total_transactions
FROM product_categories
GROUP BY product_name, color, size
HAVING COUNT(DISTINCT category) > 1  -- Only show products with multiple categories
ORDER BY product_name, color, size;

-- Query 9: Check the underlying source data patterns
-- Look at the raw notes field to understand the source data structure
SELECT 
    product_name,
    category,
    external_source,
    notes,
    transaction_date,
    reference_name
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' 
   AND size = '2XL'
   AND notes IS NOT NULL
ORDER BY transaction_date DESC
LIMIT 10;

-- Query 10: Summary analysis
-- Get a complete picture of this product's presence in the system
SELECT 
    'Total unique product-color-size-category combinations' as metric,
    COUNT(*) as value
FROM (
    SELECT DISTINCT product_name, color, size, category
    FROM public.external_inventory_management 
    WHERE product_name ILIKE '%BRITNY-BLACK%' AND size = '2XL'
) unique_combinations

UNION ALL

SELECT 
    'Total transactions' as metric,
    COUNT(*) as value
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' AND size = '2XL'

UNION ALL

SELECT 
    'Distinct categories assigned' as metric,
    COUNT(DISTINCT category) as value
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' AND size = '2XL'

UNION ALL

SELECT 
    'Net stock quantity' as metric,
    COALESCE(SUM(quantity), 0) as value
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY-BLACK%' AND size = '2XL';