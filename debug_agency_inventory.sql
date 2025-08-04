-- Debug script to investigate "horana - inthara" agency inventory issue

-- 1. Check all profiles with "horana" or "inthara" in the name
SELECT 
  id,
  name,
  agency_id,
  role,
  created_at
FROM profiles 
WHERE 
  name ILIKE '%horana%' 
  OR name ILIKE '%inthara%'
ORDER BY name;

-- 2. Check if there are multiple agencies with similar names
SELECT 
  agency_id,
  COUNT(*) as user_count,
  STRING_AGG(name, ', ') as user_names
FROM profiles 
WHERE 
  name ILIKE '%horana%' 
  OR name ILIKE '%inthara%'
GROUP BY agency_id
ORDER BY agency_id;

-- 3. Check inventory transactions for these agencies
SELECT 
  p.name as profile_name,
  p.agency_id,
  COUNT(eim.*) as transaction_count,
  MIN(eim.transaction_date) as first_transaction,
  MAX(eim.transaction_date) as last_transaction,
  STRING_AGG(DISTINCT eim.external_source, ', ') as sources
FROM profiles p
LEFT JOIN external_inventory_management eim ON p.agency_id = eim.agency_id
WHERE 
  p.name ILIKE '%horana%' 
  OR p.name ILIKE '%inthara%'
GROUP BY p.name, p.agency_id
ORDER BY p.name;

-- 4. Check if there are any external bot sync records for this agency
SELECT DISTINCT
  partner_name,
  COUNT(*) as invoice_count,
  MIN(invoice_date) as first_invoice,
  MAX(invoice_date) as last_invoice
FROM external_project_invoices 
WHERE 
  partner_name ILIKE '%horana%' 
  OR partner_name ILIKE '%inthara%'
GROUP BY partner_name
ORDER BY partner_name;

-- 5. Check the agency mapping logic - see if agency_id exists in transactions
SELECT 
  agency_id,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT product_name) as unique_products,
  STRING_AGG(DISTINCT external_source, ', ') as sources
FROM external_inventory_management
WHERE agency_id IN (
  SELECT DISTINCT agency_id 
  FROM profiles 
  WHERE name ILIKE '%horana%' OR name ILIKE '%inthara%'
)
GROUP BY agency_id;