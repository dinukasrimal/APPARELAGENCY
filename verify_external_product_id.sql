-- Verification script to check if external_product_id is being populated correctly

-- 1. Check the overall status of external_product_id population
SELECT 
  external_source,
  COUNT(*) as total_transactions,
  COUNT(external_product_id) as with_external_id,
  ROUND(100.0 * COUNT(external_product_id) / COUNT(*), 2) as external_id_percentage,
  COUNT(matched_product_id) as with_matched_id,
  ROUND(100.0 * COUNT(matched_product_id) / COUNT(*), 2) as matched_id_percentage
FROM external_inventory_management 
GROUP BY external_source
ORDER BY external_source;

-- 2. Check recent transactions to see both external_product_id and matched_product_id
SELECT 
  product_name,
  external_product_id,
  matched_product_id,
  external_source,
  transaction_date,
  CASE 
    WHEN external_product_id IS NOT NULL AND matched_product_id IS NOT NULL THEN '✅ Both IDs'
    WHEN external_product_id IS NOT NULL THEN '🔗 External ID only'
    WHEN matched_product_id IS NOT NULL THEN '📝 Matched ID only'
    ELSE '❌ No IDs'
  END as id_status
FROM external_inventory_management 
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY transaction_date DESC
LIMIT 20;

-- 3. Check for external bot transactions specifically (should have external_product_id)
SELECT 
  product_name,
  external_product_id,
  matched_product_id,
  transaction_date,
  notes
FROM external_inventory_management 
WHERE external_source = 'bot'
  AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY transaction_date DESC
LIMIT 10;

-- 4. Check for local_bot transactions specifically (should have external_product_id)
SELECT 
  product_name,
  external_product_id,
  matched_product_id,
  transaction_date,
  notes
FROM external_inventory_management 
WHERE external_source = 'local_bot'
  AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY transaction_date DESC
LIMIT 10;

-- 5. Summary statistics
SELECT 
  'Total transactions' as metric,
  COUNT(*) as count
FROM external_inventory_management
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
  'With external_product_id' as metric,
  COUNT(*) as count
FROM external_inventory_management
WHERE external_product_id IS NOT NULL
  AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
  'With matched_product_id' as metric,
  COUNT(*) as count
FROM external_inventory_management
WHERE matched_product_id IS NOT NULL
  AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
  'With both IDs' as metric,
  COUNT(*) as count
FROM external_inventory_management
WHERE external_product_id IS NOT NULL 
  AND matched_product_id IS NOT NULL
  AND transaction_date >= CURRENT_DATE - INTERVAL '7 days';