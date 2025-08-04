-- Debug script to help identify why matched_product_id is null

-- 1. Check if agencies have products in their catalog
SELECT 
  p.agency_id,
  COUNT(pr.*) as product_count,
  STRING_AGG(pr.name, ', ' ORDER BY pr.name LIMIT 5) as sample_products
FROM profiles p 
LEFT JOIN products pr ON p.agency_id = pr.agency_id
WHERE p.name ILIKE '%horana%' OR p.name ILIKE '%inthara%'
GROUP BY p.agency_id, p.name
ORDER BY p.name;

-- 2. Check recent external_inventory_management entries for matching status
SELECT 
  product_name,
  matched_product_id,
  external_source,
  agency_id,
  transaction_date,
  CASE 
    WHEN matched_product_id IS NOT NULL THEN '✅ Has Match'
    ELSE '❌ No Match'
  END as status
FROM external_inventory_management 
WHERE transaction_date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY transaction_date DESC
LIMIT 15;

-- 3. Check what products exist for a specific agency (replace with actual agency_id)
-- SELECT 
--   id,
--   name,
--   category,
--   sub_category
-- FROM products 
-- WHERE agency_id = 'REPLACE_WITH_ACTUAL_AGENCY_ID'
-- ORDER BY name;

-- 4. Check external inventory products that could potentially match
SELECT DISTINCT
  product_name,
  agency_id,
  COUNT(*) as transaction_count,
  MAX(CASE WHEN matched_product_id IS NOT NULL THEN 'YES' ELSE 'NO' END) as has_any_matches
FROM external_inventory_management 
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
  AND (product_name ILIKE '%solace%' 
       OR product_name ILIKE '%[sb%' 
       OR product_name ILIKE '%[sbe%')
GROUP BY product_name, agency_id
ORDER BY transaction_count DESC;

-- 5. Manual test of ILIKE pattern matching (to verify escaping works)
-- This will help us test if the bracket escaping is working
-- SELECT 
--   name
-- FROM products 
-- WHERE agency_id = 'REPLACE_WITH_ACTUAL_AGENCY_ID'
--   AND name ILIKE '%SB42%'  -- Test without brackets first
-- LIMIT 5;

-- 6. Check if there are orphaned external_inventory_management records
SELECT 
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN matched_product_id IS NOT NULL THEN 1 END) as matched_transactions,
  COUNT(CASE WHEN matched_product_id IS NULL THEN 1 END) as unmatched_transactions,
  ROUND(100.0 * COUNT(CASE WHEN matched_product_id IS NOT NULL THEN 1 END) / COUNT(*), 2) as match_percentage
FROM external_inventory_management 
WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days';