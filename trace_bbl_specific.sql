-- Find the specific transaction for [BBL] BRITNY-BLACK L

-- Get the exact transaction details
SELECT 
    'BBL Transaction Details' as info,
    id,
    product_name,
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
WHERE product_name = '[BBL] BRITNY-BLACK L'
ORDER BY created_at DESC;

-- Also check for similar product names in case there are variations
SELECT 
    'Similar BBL Products' as info,
    product_name,
    transaction_type,
    quantity,
    external_source,
    external_id,
    reference_name,
    transaction_date
FROM external_inventory_management
WHERE product_code = 'BBL' 
   OR product_name ILIKE '%BBL%'
ORDER BY transaction_date DESC;