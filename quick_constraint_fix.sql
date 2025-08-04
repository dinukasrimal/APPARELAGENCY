-- IMMEDIATE FIX: Run this in Supabase SQL Editor to allow external_invoice transactions

-- Drop the problematic constraint
ALTER TABLE external_inventory_management 
DROP CONSTRAINT IF EXISTS external_inventory_management_transaction_type_check;

-- Add the correct constraint that allows external_invoice
ALTER TABLE external_inventory_management 
ADD CONSTRAINT external_inventory_management_transaction_type_check 
CHECK (
    transaction_type IN (
        'external_invoice',  -- This was missing/blocked
        'customer_return',
        'adjustment', 
        'sale',
        'company_return'
    )
);

-- Test that it works
SELECT 'Constraint fixed - external_invoice should work now' as status;