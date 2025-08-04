-- Fix for external_inventory_stock_summary to properly handle size variants
-- Instead of consolidating by matched product name, preserve individual product names

DROP VIEW IF EXISTS public.external_inventory_stock_summary;

CREATE OR REPLACE VIEW public.external_inventory_stock_summary AS
WITH matched_inventory AS (
    SELECT 
        eim.*,
        p.name as product_name_from_table,
        p.category as product_category_from_table,
        p.sub_category as product_sub_category_from_table,
        -- Keep the original product name to preserve size variants
        eim.product_name as final_product_name,
        COALESCE(p.category, eim.category, 'General') as final_category,
        COALESCE(p.sub_category, eim.sub_category, 'General') as final_sub_category
    FROM external_inventory_management eim
    LEFT JOIN products p ON eim.matched_product_id = p.id
),
consolidated_products AS (
    SELECT 
        agency_id,
        -- Use the original product name to preserve size variants
        final_product_name as product_name,
        product_code,
        matched_product_id,
        final_category as category,
        final_sub_category as sub_category,
        -- Since we're grouping by exact product name, color, and size, no need to aggregate
        color,
        size,
        AVG(unit_price) as avg_unit_price,
        -- Stock calculations for this specific variant
        SUM(quantity) as current_stock,
        SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
        SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
        COUNT(*) as transaction_count,
        1 as variant_count, -- Each record represents one variant
        MAX(transaction_date) as last_transaction_date,
        MIN(transaction_date) as first_transaction_date,
        -- Additional fields for sources and transaction types
        STRING_AGG(DISTINCT external_source, ', ' ORDER BY external_source) as sources,
        STRING_AGG(DISTINCT transaction_type, ', ' ORDER BY transaction_type) as transaction_types
    FROM matched_inventory
    -- GROUP BY specific product variant (name + color + size)
    GROUP BY agency_id, final_product_name, product_code, matched_product_id, final_category, final_sub_category, color, size
)
SELECT * FROM consolidated_products
ORDER BY product_name, color, size;

-- Grant permissions
GRANT SELECT ON public.external_inventory_stock_summary TO authenticated;
GRANT SELECT ON public.external_inventory_stock_summary TO service_role;

-- Test the new view with SOLACE products
SELECT 
    'SOLACE variants test' as info,
    product_name,
    color,
    size,
    current_stock,
    total_stock_in,
    total_stock_out,
    variant_count
FROM public.external_inventory_stock_summary 
WHERE product_name LIKE '%SOLACE%'
ORDER BY product_name, size;