-- Diagnostic SQL script to understand category assignment logic for duplicate products
-- Focus on "[BB2XL] BRITNY-BLACK 2XL" appearing in both "OTHER" and "BRITNY" categories

-- SECTION 1: ROOT CAUSE ANALYSIS
-- =================================

-- 1.1: Check if the same exact product has multiple category assignments
WITH product_analysis AS (
    SELECT 
        TRIM(product_name) as clean_product_name,
        TRIM(color) as clean_color,
        TRIM(size) as clean_size,
        category,
        sub_category,
        external_source,
        COUNT(*) as transaction_count,
        SUM(quantity) as net_quantity,
        MIN(transaction_date) as first_seen,
        MAX(transaction_date) as last_seen,
        array_agg(DISTINCT transaction_id ORDER BY transaction_date) as transaction_ids,
        array_agg(DISTINCT reference_name) as references
    FROM public.external_inventory_management 
    WHERE UPPER(TRIM(product_name)) LIKE '%BRITNY-BLACK%' 
       AND UPPER(TRIM(size)) = '2XL'
    GROUP BY 
        TRIM(product_name), 
        TRIM(color), 
        TRIM(size), 
        category, 
        sub_category, 
        external_source
)
SELECT 
    clean_product_name,
    clean_color,
    clean_size,
    category,
    sub_category,
    external_source,
    transaction_count,
    net_quantity,
    first_seen,
    last_seen,
    array_length(transaction_ids, 1) as unique_transactions,
    transaction_ids,
    references
FROM product_analysis
ORDER BY clean_product_name, clean_color, clean_size, first_seen;

-- 1.2: Check for product name variations that might cause different categorizations  
SELECT 
    product_name,
    LENGTH(product_name) as name_length,
    category,
    COUNT(*) as occurrences,
    SUM(quantity) as total_quantity
FROM public.external_inventory_management 
WHERE (
    product_name ILIKE '%BRITNY%BLACK%' 
    OR product_name ILIKE '%BB2XL%BRITNY%'
    OR product_code ILIKE '%BB2XL%'
) AND size ILIKE '%2XL%'
GROUP BY product_name, category
ORDER BY product_name, category;

-- SECTION 2: CATEGORY ASSIGNMENT PATTERNS
-- =======================================

-- 2.1: Analyze category assignment by external source
SELECT 
    external_source,
    category,
    COUNT(DISTINCT CONCAT(product_name, '-', color, '-', size)) as unique_products,
    COUNT(*) as total_transactions,
    SUM(quantity) as total_quantity,
    MIN(transaction_date) as earliest_transaction,
    MAX(transaction_date) as latest_transaction
FROM public.external_inventory_management 
WHERE product_name ILIKE '%BRITNY%'
GROUP BY external_source, category
ORDER BY external_source, category;

-- 2.2: Check if there's a pattern in how categories are derived from product names
WITH category_patterns AS (
    SELECT 
        product_name,
        product_code,
        category,
        CASE 
            WHEN product_name ILIKE '%BRITNY%' THEN 'Contains BRITNY'
            WHEN product_code ILIKE '%BB%' THEN 'BB Code'
            ELSE 'Other Pattern'
        END as naming_pattern,
        external_source,
        COUNT(*) as count
    FROM public.external_inventory_management 
    WHERE product_name ILIKE '%BRITNY%' OR product_code ILIKE '%BB%'
    GROUP BY product_name, product_code, category, external_source
)
SELECT 
    naming_pattern,
    category,
    external_source,
    COUNT(*) as pattern_occurrences,
    array_agg(DISTINCT product_name ORDER BY product_name) as sample_products
FROM category_patterns
GROUP BY naming_pattern, category, external_source
ORDER BY naming_pattern, category, external_source;

-- SECTION 3: DATA INTEGRITY CHECKS
-- ================================

-- 3.1: Check for exact duplicates (same product, different categories)
WITH product_categories AS (
    SELECT 
        product_name,
        color,
        size,
        array_agg(DISTINCT category ORDER BY category) as categories,
        array_agg(DISTINCT external_source ORDER BY external_source) as sources,
        COUNT(DISTINCT category) as category_count,
        SUM(quantity) as total_stock
    FROM public.external_inventory_management 
    WHERE UPPER(product_name) LIKE '%BRITNY%' 
       AND UPPER(size) = '2XL'
    GROUP BY product_name, color, size
)
SELECT 
    product_name,
    color,
    size,
    categories,
    sources,
    category_count,
    total_stock,
    CASE 
        WHEN category_count > 1 THEN 'DUPLICATE CATEGORIES'
        ELSE 'Single Category'
    END as status
FROM product_categories
WHERE category_count > 1  -- Focus on products with multiple categories
ORDER BY product_name, color, size;

-- SECTION 4: TRANSACTION HISTORY ANALYSIS
-- =======================================

-- 4.1: Chronological view of category assignments
SELECT 
    product_name,
    color,
    size,
    category,
    transaction_type,
    quantity,
    transaction_date,
    external_source,
    reference_name,
    user_name,
    CASE 
        WHEN LAG(category) OVER (
            PARTITION BY product_name, color, size 
            ORDER BY transaction_date
        ) != category THEN 'CATEGORY CHANGED'
        ELSE 'Same Category'
    END as category_status,
    ROW_NUMBER() OVER (
        PARTITION BY product_name, color, size 
        ORDER BY transaction_date
    ) as transaction_sequence
FROM public.external_inventory_management 
WHERE UPPER(product_name) LIKE '%BRITNY-BLACK%' 
   AND UPPER(size) = '2XL'
ORDER BY product_name, color, size, transaction_date;

-- SECTION 5: RECOMMENDED FIXES
-- ============================

-- 5.1: Generate a report of products that need category standardization
WITH problematic_products AS (
    SELECT 
        product_name,
        color,
        size,
        array_agg(DISTINCT category ORDER BY category) as all_categories,
        COUNT(DISTINCT category) as category_count,
        SUM(quantity) as net_stock,
        MAX(transaction_date) as last_transaction
    FROM public.external_inventory_management 
    GROUP BY product_name, color, size
    HAVING COUNT(DISTINCT category) > 1
)
SELECT 
    product_name,
    color,
    size,
    all_categories,
    category_count,
    net_stock,
    last_transaction,
    CASE 
        WHEN product_name ILIKE '%BRITNY%' THEN 'BRITNY'
        WHEN product_name ILIKE '%COLOR%VEST%' THEN 'CV'
        WHEN product_name ILIKE '%SHORTS%' THEN 'SHORTS'
        ELSE 'OTHER'
    END as suggested_category
FROM problematic_products
ORDER BY category_count DESC, product_name;

-- 5.2: Show the impact of category duplication on stock summary
SELECT 
    category,
    COUNT(DISTINCT CONCAT(product_name, '-', color, '-', size)) as unique_products,
    SUM(current_stock) as total_stock,
    COUNT(*) as summary_entries
FROM public.external_inventory_stock_summary 
WHERE product_name ILIKE '%BRITNY%'
GROUP BY category
ORDER BY category;

-- SECTION 6: DEBUGGING THE SPECIFIC CASE
-- ======================================

-- 6.1: Deep dive into the specific "[BB2XL] BRITNY-BLACK 2XL" product
SELECT 
    id,
    product_name,
    product_code,
    color,
    size,
    category,
    sub_category,
    transaction_type,
    quantity,
    unit_price,
    reference_name,
    transaction_date,
    created_at,
    external_source,
    external_id,
    external_reference,
    user_name,
    agency_id,
    -- Try to parse the notes field to understand source data
    CASE 
        WHEN notes IS NOT NULL AND notes != '' THEN 
            LEFT(notes, 200) || CASE WHEN LENGTH(notes) > 200 THEN '...' ELSE '' END
        ELSE 'No notes'
    END as notes_preview
FROM public.external_inventory_management 
WHERE (
    UPPER(TRIM(product_name)) = '[BB2XL] BRITNY-BLACK'
    OR UPPER(TRIM(product_name)) LIKE '%BB2XL%BRITNY-BLACK%'
    OR (product_code = 'BB2XL' AND product_name ILIKE '%BRITNY%BLACK%')
) AND UPPER(TRIM(size)) = '2XL'
ORDER BY transaction_date DESC, created_at DESC;