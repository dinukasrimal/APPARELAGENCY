-- Update external_inventory_stock_summary view to use matched_product_id for proper consolidation
-- This will solve the issue where same products appear separately (like SB28/SBE28 SOLACE products)

DROP VIEW IF EXISTS public.external_inventory_stock_summary;

CREATE OR REPLACE VIEW public.external_inventory_stock_summary AS
WITH matched_inventory AS (
    -- Join with products table to get standardized product info
    SELECT 
        eim.*,
        p.name as product_name_standardized,
        p.category as product_category_standardized,
        p.sub_category as product_sub_category_standardized,
        p.id as product_id,
        -- Use matched product info if available, otherwise fall back to external inventory info
        CASE 
            WHEN eim.matched_product_id IS NOT NULL THEN p.name
            ELSE eim.product_name 
        END as final_product_name,
        CASE 
            WHEN eim.matched_product_id IS NOT NULL THEN COALESCE(p.category, 'General')
            ELSE COALESCE(eim.category, 'General')
        END as final_category,
        CASE 
            WHEN eim.matched_product_id IS NOT NULL THEN COALESCE(p.sub_category, 'General')
            ELSE COALESCE(eim.sub_category, 'General')
        END as final_sub_category
    FROM external_inventory_management eim
    LEFT JOIN products p ON eim.matched_product_id = p.id
),
consolidated_products AS (
    SELECT 
        agency_id,
        -- Group by matched_product_id when available, otherwise by product_name
        COALESCE(matched_product_id::text, 'unmatched_' || MD5(final_product_name)) as grouping_key,
        matched_product_id,
        final_product_name as product_name,
        final_category as category,
        final_sub_category as sub_category,
        
        -- Extract product code from the final product name
        (SELECT regexp_matches(final_product_name, '\[([^\]]+)\]'))[1] as product_code,
        
        -- Consolidate all colors/sizes into summary strings
        STRING_AGG(DISTINCT color, ', ' ORDER BY color) as color,
        STRING_AGG(DISTINCT size, ', ' ORDER BY size) as size,
        
        -- Stock calculations - THIS IS THE KEY IMPROVEMENT
        AVG(unit_price) as avg_unit_price,
        SUM(quantity) as current_stock,                    -- Net stock: Stock IN - Stock OUT
        SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
        SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
        
        -- Transaction details
        COUNT(*) as transaction_count,
        COUNT(DISTINCT CONCAT(COALESCE(color, 'Default'), '|', COALESCE(size, 'Default'))) as variant_count,
        MAX(transaction_date) as last_transaction_date,
        MIN(transaction_date) as first_transaction_date,
        
        -- Source tracking
        STRING_AGG(DISTINCT external_source, ', ') as sources,
        STRING_AGG(DISTINCT transaction_type, ', ') as transaction_types
        
    FROM matched_inventory
    -- GROUP BY THE GROUPING KEY - this consolidates same products
    GROUP BY 
        agency_id, 
        COALESCE(matched_product_id::text, 'unmatched_' || MD5(final_product_name)),
        matched_product_id,
        final_product_name,
        final_category,
        final_sub_category
)
SELECT 
    agency_id,
    matched_product_id,
    product_name,
    product_code,
    color,
    size,
    category,
    sub_category,
    avg_unit_price,
    current_stock,
    total_stock_in,
    total_stock_out,
    transaction_count,
    variant_count,
    last_transaction_date,
    first_transaction_date,
    sources,
    transaction_types
FROM consolidated_products
-- Show all products, including those with 0 stock (for complete inventory view)
ORDER BY 
    CASE WHEN current_stock < 0 THEN 0 ELSE 1 END, -- Negative stock first (issues)
    ABS(current_stock) DESC, -- Then by stock quantity
    product_name;

-- Grant permissions
GRANT SELECT ON public.external_inventory_stock_summary TO authenticated;
GRANT SELECT ON public.external_inventory_stock_summary TO service_role;

-- Create a helper view for quick stock status lookup
CREATE OR REPLACE VIEW public.external_inventory_stock_status AS
SELECT 
    *,
    CASE 
        WHEN current_stock <= 0 THEN 'out_of_stock'
        WHEN current_stock <= 5 THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status,
    current_stock * avg_unit_price as total_value
FROM public.external_inventory_stock_summary;

GRANT SELECT ON public.external_inventory_stock_status TO authenticated;
GRANT SELECT ON public.external_inventory_stock_status TO service_role;

-- Test query to check SOLACE products consolidation
SELECT 
    product_name,
    matched_product_id,
    current_stock,
    total_stock_in,
    total_stock_out,
    variant_count,
    transaction_types,
    sources
FROM public.external_inventory_stock_summary 
WHERE product_name ILIKE '%solace%'
ORDER BY product_name;

-- Summary statistics
SELECT 
    'Total Products' as metric,
    COUNT(*) as value
FROM public.external_inventory_stock_summary

UNION ALL

SELECT 
    'Products with Matches' as metric,
    COUNT(*) as value
FROM public.external_inventory_stock_summary 
WHERE matched_product_id IS NOT NULL

UNION ALL

SELECT 
    'Products Needing Matches' as metric,
    COUNT(*) as value
FROM public.external_inventory_stock_summary 
WHERE matched_product_id IS NULL

UNION ALL

SELECT 
    'Out of Stock Items' as metric,
    COUNT(*) as value
FROM public.external_inventory_stock_summary 
WHERE current_stock <= 0

UNION ALL

SELECT 
    'Low Stock Items' as metric,
    COUNT(*) as value
FROM public.external_inventory_stock_summary 
WHERE current_stock > 0 AND current_stock <= 5;