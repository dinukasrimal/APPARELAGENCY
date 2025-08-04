-- Add matched_product_id column to external_inventory_management for better stock management
-- This links external inventory records to the actual products table

-- Step 1: Add the new column
ALTER TABLE external_inventory_management 
ADD COLUMN matched_product_id UUID REFERENCES products(id);

-- Step 2: Add index for performance
CREATE INDEX idx_external_inventory_matched_product 
ON external_inventory_management(matched_product_id);

-- Step 3: Create fuzzy matching function to link external inventory to products
CREATE OR REPLACE FUNCTION match_external_inventory_to_products()
RETURNS void AS $$
DECLARE
    external_record RECORD;
    found_product_id UUID;
BEGIN
    -- Loop through all external inventory records that don't have a match yet
    FOR external_record IN 
        SELECT id, product_name, product_code, category, sub_category
        FROM external_inventory_management 
        WHERE matched_product_id IS NULL
    LOOP
        -- Try to find matching product using various criteria
        found_product_id := NULL;
        
        -- Method 1: Exact name match
        SELECT p.id INTO found_product_id
        FROM products p
        WHERE LOWER(p.name) = LOWER(external_record.product_name)
        LIMIT 1;
        
        -- Method 2: Product code match (extract code from name)
        IF found_product_id IS NULL AND external_record.product_code IS NOT NULL THEN
            SELECT p.id INTO found_product_id
            FROM products p
            WHERE LOWER(p.name) LIKE '%' || LOWER(external_record.product_code) || '%'
            LIMIT 1;
        END IF;
        
        -- Method 3: Fuzzy name matching (remove brackets and variations)
        IF found_product_id IS NULL THEN
            SELECT p.id INTO found_product_id
            FROM products p
            WHERE LOWER(REGEXP_REPLACE(p.name, '\[[^\]]*\]', '', 'g')) = 
                  LOWER(REGEXP_REPLACE(external_record.product_name, '\[[^\]]*\]', '', 'g'))
            LIMIT 1;
        END IF;
        
        -- Method 4: Similarity matching (for products like SOLACE-BLACK vs SOLACE-BEIGH)
        IF found_product_id IS NULL THEN
            SELECT p.id INTO found_product_id
            FROM products p
            WHERE SIMILARITY(
                LOWER(REGEXP_REPLACE(p.name, '-(black|beigh|white|red|blue|green)', '', 'g')), 
                LOWER(REGEXP_REPLACE(external_record.product_name, '-(black|beigh|white|red|blue|green)', '', 'g'))
            ) > 0.7
            ORDER BY SIMILARITY(
                LOWER(REGEXP_REPLACE(p.name, '-(black|beigh|white|red|blue|green)', '', 'g')), 
                LOWER(REGEXP_REPLACE(external_record.product_name, '-(black|beigh|white|red|blue|green)', '', 'g'))
            ) DESC
            LIMIT 1;
        END IF;
        
        -- Update the external inventory record with the matched product
        IF found_product_id IS NOT NULL THEN
            UPDATE external_inventory_management 
            SET matched_product_id = found_product_id
            WHERE id = external_record.id;
            
            RAISE NOTICE 'Matched: % -> Product ID: %', external_record.product_name, found_product_id;
        ELSE
            RAISE NOTICE 'No match found for: %', external_record.product_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Enable similarity extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 5: Run the initial matching for existing records
SELECT match_external_inventory_to_products();

-- Step 6: Create updated stock summary view using matched products
DROP VIEW IF EXISTS public.external_inventory_stock_summary;

CREATE OR REPLACE VIEW public.external_inventory_stock_summary AS
WITH matched_inventory AS (
    SELECT 
        eim.*,
        p.name as product_name_from_table,
        p.category as product_category_from_table,
        p.sub_category as product_sub_category_from_table,
        COALESCE(p.name, eim.product_name) as final_product_name,
        COALESCE(p.category, eim.category, 'General') as final_category,
        COALESCE(p.sub_category, eim.sub_category, 'General') as final_sub_category
    FROM external_inventory_management eim
    LEFT JOIN products p ON eim.matched_product_id = p.id
),
consolidated_products AS (
    SELECT 
        agency_id,
        -- Use the matched product info if available, otherwise use external inventory info
        final_product_name as product_name,
        matched_product_id,
        final_category as category,
        final_sub_category as sub_category,
        -- Consolidate all colors/sizes into summary strings
        STRING_AGG(DISTINCT color, ', ' ORDER BY color) as color,
        STRING_AGG(DISTINCT size, ', ' ORDER BY size) as size,
        AVG(unit_price) as avg_unit_price,
        -- CONSOLIDATED STOCK: Sum ALL transactions for this matched product
        SUM(quantity) as current_stock,
        SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
        SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT CONCAT(color, '|', size)) as variant_count,
        MAX(transaction_date) as last_transaction_date,
        MIN(transaction_date) as first_transaction_date
    FROM matched_inventory
    -- GROUP BY MATCHED PRODUCT - this is the key improvement
    GROUP BY agency_id, final_product_name, matched_product_id, final_category, final_sub_category
)
SELECT * FROM consolidated_products
ORDER BY product_name;

-- Grant permissions
GRANT SELECT ON public.external_inventory_stock_summary TO authenticated;
GRANT SELECT ON public.external_inventory_stock_summary TO service_role;

-- Step 7: Test the new view
SELECT 
    product_name,
    matched_product_id,
    category,
    current_stock,
    total_stock_in,
    total_stock_out,
    variant_count
FROM public.external_inventory_stock_summary 
WHERE product_name LIKE '%SOLACE%'
ORDER BY product_name;