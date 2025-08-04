-- Script to update existing stock categories from products table
-- This will fix inconsistent categories in external_inventory_management table

-- Step 1: Create a temporary function to find correct categories for products
CREATE OR REPLACE FUNCTION get_product_category_info(p_product_name TEXT)
RETURNS TABLE(category TEXT, sub_category TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    product_code TEXT;
BEGIN
    -- First try exact name match
    SELECT p.category, p.sub_category 
    INTO category, sub_category
    FROM products p 
    WHERE p.name = p_product_name
    LIMIT 1;
    
    IF FOUND THEN
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Extract product code from name (e.g., "[BB2XL] BRITNY-BLACK 2XL" -> "BB2XL")
    SELECT substring(p_product_name FROM '\[([^\]]+)\]') INTO product_code;
    
    -- If we have a product code, try pattern matching
    IF product_code IS NOT NULL THEN
        SELECT p.category, p.sub_category 
        INTO category, sub_category
        FROM products p 
        WHERE p.name ILIKE '%' || product_code || '%'
        LIMIT 1;
        
        IF FOUND THEN
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Fallback to defaults
    category := 'General';
    sub_category := 'General';
    RETURN NEXT;
END;
$$;

-- Step 2: Show current category inconsistencies (for review)
DO $$
BEGIN
    RAISE NOTICE 'Current category inconsistencies:';
END $$;

SELECT 
    product_name,
    COUNT(DISTINCT category) as category_count,
    STRING_AGG(DISTINCT category, ', ') as categories,
    COUNT(DISTINCT sub_category) as sub_category_count,
    STRING_AGG(DISTINCT sub_category, ', ') as sub_categories,
    SUM(quantity) as total_stock
FROM external_inventory_management
GROUP BY product_name
HAVING COUNT(DISTINCT category) > 1 OR COUNT(DISTINCT sub_category) > 1
ORDER BY product_name;

-- Step 3: Preview the category updates that will be made
SELECT 
    eim.product_name,
    eim.category as current_category,
    eim.sub_category as current_sub_category,
    pci.category as new_category,
    pci.sub_category as new_sub_category,
    COUNT(*) as transaction_count,
    SUM(eim.quantity) as total_quantity
FROM external_inventory_management eim
CROSS JOIN LATERAL get_product_category_info(eim.product_name) pci
WHERE eim.category != pci.category OR eim.sub_category != pci.sub_category
GROUP BY eim.product_name, eim.category, eim.sub_category, pci.category, pci.sub_category
ORDER BY eim.product_name;

-- Step 4: Create backup table before making changes
CREATE TABLE IF NOT EXISTS external_inventory_management_backup_categories AS
SELECT * FROM external_inventory_management;

-- Step 5: Update the categories in external_inventory_management table
UPDATE external_inventory_management eim
SET 
    category = pci.category,
    sub_category = pci.sub_category,
    updated_at = NOW()
FROM get_product_category_info(eim.product_name) pci
WHERE eim.category != pci.category OR eim.sub_category != pci.sub_category;

-- Step 6: Show summary of changes made
SELECT 
    'Changes Applied' as status,
    COUNT(*) as updated_transactions
FROM external_inventory_management eim1
JOIN external_inventory_management_backup_categories backup 
    ON eim1.id = backup.id
WHERE eim1.category != backup.category OR eim1.sub_category != backup.sub_category;

-- Step 7: Verify no more inconsistencies exist
SELECT 
    'After Update - Remaining Inconsistencies' as status,
    product_name,
    COUNT(DISTINCT category) as category_count,
    STRING_AGG(DISTINCT category, ', ') as categories,
    COUNT(DISTINCT sub_category) as sub_category_count,
    STRING_AGG(DISTINCT sub_category, ', ') as sub_categories
FROM external_inventory_management
GROUP BY product_name
HAVING COUNT(DISTINCT category) > 1 OR COUNT(DISTINCT sub_category) > 1
ORDER BY product_name;

-- Step 8: Clean up temporary function
DROP FUNCTION get_product_category_info(TEXT);

-- Step 9: Show final stock summary with corrected categories
SELECT 
    'Final Stock Summary' as status,
    category,
    sub_category,
    COUNT(DISTINCT product_name) as unique_products,
    COUNT(*) as total_transactions,
    SUM(quantity) as total_stock
FROM external_inventory_management
GROUP BY category, sub_category
ORDER BY category, sub_category;

COMMIT;