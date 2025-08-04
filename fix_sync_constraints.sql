-- Fix the database constraints to allow local invoice sync

-- Step 1: Check current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'external_inventory_management'::regclass
  AND conname LIKE '%transaction_type%';

-- Step 2: Drop the existing constraint
ALTER TABLE external_inventory_management 
DROP CONSTRAINT IF EXISTS external_inventory_management_transaction_type_check;

-- Step 3: Add the correct constraint that allows external_invoice
ALTER TABLE external_inventory_management 
ADD CONSTRAINT external_inventory_management_transaction_type_check 
CHECK (
    transaction_type IN (
        'external_invoice',  -- Stock IN: External invoices from local table
        'customer_return',   -- Stock IN: Customer returns
        'adjustment',        -- Stock IN/OUT: Manual adjustments
        'sale',             -- Stock OUT: Customer sales
        'company_return'    -- Stock OUT: Company returns
    )
);

-- Step 4: Verify the constraint is correct
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'external_inventory_management'::regclass
  AND conname LIKE '%transaction_type%';

-- Step 5: Test insert to make sure it works
-- This should succeed now
INSERT INTO external_inventory_management (
    product_name,
    product_code,
    color,
    size,
    category,
    sub_category,
    unit_price,
    transaction_type,
    transaction_id,
    quantity,
    reference_name,
    agency_id,
    user_name,
    transaction_date,
    notes,
    external_source,
    external_id,
    external_reference
) VALUES (
    'TEST_PRODUCT',
    'TEST',
    'Default',
    'Default',
    'General',
    'General',
    0,
    'external_invoice',  -- This should work now
    'TEST-001',
    1,
    'Test Customer',
    '00000000-0000-0000-0000-000000000000', -- Replace with actual agency ID
    'Test User',
    NOW(),
    'Test transaction',
    'local_bot',
    'TEST-001',
    'Test Reference'
);

-- Step 6: Remove the test record
DELETE FROM external_inventory_management 
WHERE transaction_id = 'TEST-001' AND product_name = 'TEST_PRODUCT';

COMMIT;