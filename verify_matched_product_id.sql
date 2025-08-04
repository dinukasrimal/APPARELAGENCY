-- Verification script to check if matched_product_id is being populated correctly

-- 1. Check the overall status of matched_product_id population
SELECT 
  external_source,
  COUNT(*) as total_transactions,
  COUNT(matched_product_id) as with_matched_id,
  ROUND(100.0 * COUNT(matched_product_id) / COUNT(*), 2) as match_percentage
FROM external_inventory_management 
GROUP BY external_source
ORDER BY external_source;

-- 2. Check recent transactions to see if new ones have matched_product_id
SELECT 
  product_name,
  matched_product_id,
  external_source,
  transaction_date,
  agency_id,
  CASE 
    WHEN matched_product_id IS NOT NULL THEN '✅ Matched'
    ELSE '⚠️ Not matched'
  END as match_status
FROM external_inventory_management 
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY transaction_date DESC
LIMIT 20;

-- 3. Check if matched products exist in products table (verify referential integrity)
SELECT 
  eim.product_name,
  eim.matched_product_id,
  p.name as matched_product_name,
  p.category as matched_category,
  eim.external_source
FROM external_inventory_management eim
LEFT JOIN products p ON eim.matched_product_id = p.id
WHERE eim.matched_product_id IS NOT NULL
  AND eim.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
LIMIT 15;

-- 4. Identify which agencies have good/poor matching rates
SELECT 
  eim.agency_id,
  COUNT(*) as total_transactions,
  COUNT(eim.matched_product_id) as matched_transactions,
  ROUND(100.0 * COUNT(eim.matched_product_id) / COUNT(*), 2) as match_percentage,
  STRING_AGG(DISTINCT eim.external_source, ', ') as sources
FROM external_inventory_management eim
WHERE eim.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY eim.agency_id
ORDER BY match_percentage DESC;

-- 5. Check specific product matching patterns (for troubleshooting)
SELECT 
  eim.product_name,
  COUNT(*) as transaction_count,
  COUNT(eim.matched_product_id) as matched_count,
  CASE 
    WHEN COUNT(eim.matched_product_id) > 0 THEN 
      (SELECT p.name FROM products p WHERE p.id = MIN(eim.matched_product_id))
    ELSE 'No match'
  END as matched_to
FROM external_inventory_management eim
WHERE eim.product_name ILIKE '%horana%' 
   OR eim.product_name ILIKE '%inthara%'
   OR eim.product_name ILIKE '%solace%'
   OR eim.product_name ILIKE '%[sb%'
   OR eim.product_name ILIKE '%[sbe%'
GROUP BY eim.product_name
ORDER BY transaction_count DESC;