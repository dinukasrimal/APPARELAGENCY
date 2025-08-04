-- Fix the external_inventory_stock_summary view to consolidate products by NAME ONLY
-- This addresses the user's requirement: same product names should be ONE inventory item
-- Example: [SBE28] SOLACE-BEIGH 28 with different colors/sizes = ONE consolidated entry

DROP VIEW IF EXISTS public.external_inventory_stock_summary;

CREATE OR REPLACE VIEW public.external_inventory_stock_summary AS
WITH consolidated_products AS (
    SELECT 
        agency_id,
        product_name,
        product_code,
        -- Consolidate all colors/sizes into summary strings
        STRING_AGG(DISTINCT color, ', ' ORDER BY color) as color,
        STRING_AGG(DISTINCT size, ', ' ORDER BY size) as size,
        -- Use the most common category for the product name
        (
            SELECT category 
            FROM external_inventory_management AS eim2 
            WHERE eim2.agency_id = eim.agency_id
              AND eim2.product_name = eim.product_name 
              AND eim2.category IS NOT NULL 
              AND eim2.category != 'General'
            GROUP BY category
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as category,
        (
            SELECT sub_category 
            FROM external_inventory_management AS eim2 
            WHERE eim2.agency_id = eim.agency_id
              AND eim2.product_name = eim.product_name 
              AND eim2.sub_category IS NOT NULL 
              AND eim2.sub_category != 'General'
            GROUP BY sub_category
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as sub_category,
        AVG(unit_price) as avg_unit_price,
        -- CONSOLIDATED STOCK: Sum ALL transactions for this product name
        SUM(quantity) as current_stock,                    -- Net stock balance across all variants
        SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
        SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT CONCAT(color, '|', size)) as variant_count, -- Number of color/size combinations
        MAX(transaction_date) as last_transaction_date,
        MIN(transaction_date) as first_transaction_date
    FROM public.external_inventory_management AS eim
    -- GROUP BY PRODUCT NAME ONLY - this is the key change
    GROUP BY agency_id, product_name, product_code
)
SELECT 
    agency_id,
    product_name,
    product_code,
    color,
    size,
    COALESCE(category, 'General') as category,
    COALESCE(sub_category, 'General') as sub_category,
    avg_unit_price,
    current_stock,
    total_stock_in,
    total_stock_out,
    transaction_count,
    variant_count,
    last_transaction_date,
    first_transaction_date
FROM consolidated_products
-- Show all products, even those with 0 stock (for complete inventory view)
ORDER BY product_name;

-- Grant necessary permissions
GRANT SELECT ON public.external_inventory_stock_summary TO authenticated;
GRANT SELECT ON public.external_inventory_stock_summary TO service_role;

-- Test the view
SELECT 
    product_name,
    color,
    size,
    category,
    current_stock,
    total_stock_in,
    total_stock_out
FROM public.external_inventory_stock_summary 
WHERE product_name LIKE '%SOLACE-BEIGH%'
ORDER BY product_name, size;