-- Stock Count Query: Match products.description with external_inventory_management.product_name
-- Shows total stock for each product using SUM aggregation
-- FIXED: Handle product codes in brackets like "[SB42] SOLACE-BLACK 42" vs "SOLACE-BLACK 42"

SELECT 
    p.id as product_id,
    p.name as product_name,
    p.description,
    p.category,
    p.sub_category,
    COALESCE(SUM(eim.quantity), 0) as total_stock,
    COUNT(eim.id) as transaction_count,
    MIN(eim.created_at) as first_transaction_date,
    MAX(eim.created_at) as last_transaction_date
FROM 
    products p
LEFT JOIN 
    external_inventory_management eim 
    ON p.description = TRIM(REGEXP_REPLACE(eim.product_name, '^\[[^\]]*\]\s*', '', 'g'))
GROUP BY 
    p.id, 
    p.name, 
    p.description, 
    p.category, 
    p.sub_category
ORDER BY 
    total_stock DESC, 
    p.name ASC;

-- Alternative query with more detailed breakdown by color and size
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.description,
    p.category,
    p.sub_category,
    eim.color,
    eim.size,
    COALESCE(SUM(eim.quantity), 0) as stock_by_variant,
    COUNT(eim.id) as transaction_count
FROM 
    products p
LEFT JOIN 
    external_inventory_management eim 
    ON p.description = TRIM(REGEXP_REPLACE(eim.product_name, '^\[[^\]]*\]\s*', '', 'g'))
GROUP BY 
    p.id, 
    p.name, 
    p.description, 
    p.category, 
    p.sub_category,
    eim.color,
    eim.size
HAVING 
    SUM(eim.quantity) IS NOT NULL  -- Only show products with inventory records
ORDER BY 
    p.name ASC,
    stock_by_variant DESC;

-- Summary query showing only products with positive stock
SELECT 
    p.name as product_name,
    p.description,
    SUM(eim.quantity) as current_stock
FROM 
    products p
INNER JOIN 
    external_inventory_management eim 
    ON p.description = TRIM(REGEXP_REPLACE(eim.product_name, '^\[[^\]]*\]\s*', '', 'g'))
GROUP BY 
    p.id, 
    p.name, 
    p.description
HAVING 
    SUM(eim.quantity) > 0
ORDER BY 
    current_stock DESC;