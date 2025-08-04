-- Trace stock for [BBL] BRITNY-BLACK L for user Oshada

-- Step 1: Find Oshada's agency ID first
SELECT 
    'Oshada User Info' as info,
    id as user_id,
    name,
    agency_id,
    role
FROM profiles 
WHERE name ILIKE '%oshada%' OR email ILIKE '%oshada%';

-- Step 2: Find all transactions for [BBL] BRITNY-BLACK L product
-- Replace 'OSHADA_AGENCY_ID' with the actual agency_id from Step 1
SELECT 
    'All transactions for BBL BRITNY-BLACK L' as info,
    id,
    transaction_type,
    quantity,
    external_source,
    external_id,
    reference_name,
    transaction_date,
    created_at,
    user_name,
    notes,
    agency_id
FROM external_inventory_management
WHERE product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL'
ORDER BY transaction_date DESC, created_at DESC;

-- Step 3: Calculate stock breakdown by transaction type
SELECT 
    'Stock breakdown by transaction type' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity,
    MIN(transaction_date) as first_transaction,
    MAX(transaction_date) as last_transaction
FROM external_inventory_management
WHERE (product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL')
GROUP BY transaction_type, external_source
ORDER BY total_quantity DESC;

-- Step 4: Check current stock summary for this product
SELECT 
    'Current stock summary' as info,
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
    agency_id
FROM external_inventory_stock_summary
WHERE product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL';

-- Step 5: Check if there are external bot invoices for this product
SELECT 
    'External bot invoices for BBL' as info,
    external_id,
    reference_name,
    transaction_date,
    quantity,
    notes
FROM external_inventory_management
WHERE (product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL')
   AND external_source = 'bot'
   AND transaction_type = 'external_invoice'
ORDER BY transaction_date DESC;

-- Step 6: Check if there are customer returns for this product
SELECT 
    'Customer returns for BBL' as info,
    reference_name,
    transaction_date,
    quantity,
    notes
FROM external_inventory_management
WHERE (product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL')
   AND transaction_type = 'customer_return'
ORDER BY transaction_date DESC;

-- Step 7: Check if there are approved adjustments for this product
SELECT 
    'Approved adjustments for BBL' as info,
    reference_name,
    transaction_date,
    quantity,
    user_name,
    notes
FROM external_inventory_management
WHERE (product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL')
   AND transaction_type = 'adjustment'
ORDER BY transaction_date DESC;

-- Step 8: Check if there are any sales (stock OUT) for this product
SELECT 
    'Sales/Stock OUT for BBL' as info,
    reference_name,
    transaction_date,
    quantity,
    notes
FROM external_inventory_management
WHERE (product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL')
   AND quantity < 0  -- Negative quantities are stock OUT
ORDER BY transaction_date DESC;

-- Step 9: Manual calculation to verify stock total
SELECT 
    'Manual stock calculation' as info,
    SUM(quantity) as calculated_current_stock,
    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out
FROM external_inventory_management
WHERE product_name ILIKE '%BBL%BRITNY-BLACK%L%'
   OR product_name ILIKE '%BRITNY-BLACK%L%'
   OR product_code = 'BBL';

-- Step 10: Check for exact product name matches
SELECT DISTINCT 
    'Exact product names found' as info,
    product_name,
    product_code,
    COUNT(*) as transaction_count,
    SUM(quantity) as net_stock
FROM external_inventory_management
WHERE product_name ILIKE '%BRITNY%' 
   AND (product_name ILIKE '%BLACK%' OR color ILIKE '%BLACK%')
   AND (size ILIKE '%L%' OR product_name ILIKE '%L%')
GROUP BY product_name, product_code
ORDER BY net_stock DESC;