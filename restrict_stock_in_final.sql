-- Final script to restrict stock IN to only: external invoices, customer returns, and adjustments

-- Step 1: Check current stock IN sources
SELECT 
    'Current Stock IN Sources' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_stock_in,
    COUNT(DISTINCT product_name) as unique_products
FROM external_inventory_management
WHERE quantity > 0  -- Only positive quantities (stock IN)
GROUP BY transaction_type, external_source
ORDER BY total_stock_in DESC;

-- Step 2: Identify unwanted stock IN transactions (excluding the 3 allowed sources)
SELECT 
    'Unwanted Stock IN Transactions' as info,
    transaction_type,
    external_source,
    COUNT(*) as count_to_remove,
    SUM(quantity) as stock_to_remove
FROM external_inventory_management
WHERE quantity > 0  -- Stock IN
  AND transaction_type NOT IN ('external_invoice', 'customer_return', 'adjustment')
GROUP BY transaction_type, external_source;

-- Step 3: Show specific unwanted records
SELECT 
    'Records to be removed' as info,
    id,
    product_name,
    transaction_type,
    quantity,
    external_source,
    reference_name,
    created_at
FROM external_inventory_management
WHERE quantity > 0  -- Stock IN
  AND transaction_type NOT IN ('external_invoice', 'customer_return', 'adjustment')
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: CREATE BACKUP before making changes
CREATE TABLE IF NOT EXISTS external_inventory_backup_final AS
SELECT * FROM external_inventory_management;

-- Step 5: Remove only unwanted stock IN transactions (like GRNs)
-- Keep: external_invoice, customer_return, adjustment
DELETE FROM external_inventory_management
WHERE quantity > 0  -- Only positive quantities (stock IN)
  AND transaction_type NOT IN ('external_invoice', 'customer_return', 'adjustment');

-- Step 6: Update database constraints to allow the 3 approved sources
ALTER TABLE external_inventory_management 
DROP CONSTRAINT IF EXISTS external_inventory_management_transaction_type_check;

-- Add constraint allowing your 3 approved stock IN sources plus stock OUT sources
ALTER TABLE external_inventory_management 
ADD CONSTRAINT external_inventory_management_transaction_type_check 
CHECK (
    transaction_type IN (
        'external_invoice',  -- Stock IN: External bot invoices
        'customer_return',   -- Stock IN: Customer returns
        'adjustment',        -- Stock IN/OUT: Manual adjustments (both positive and negative)
        'sale',             -- Stock OUT: Customer sales (negative quantity)
        'company_return'    -- Stock OUT: Company returns (negative quantity)
    )
);

-- Step 7: Update the database comment
COMMENT ON COLUMN public.external_inventory_management.transaction_type IS 
'Type of inventory transaction: external_invoice, customer_return, adjustment (stock IN), sale, company_return (stock OUT)';

-- Step 8: Verify only desired stock IN sources remain
SELECT 
    'After Cleanup - Remaining Stock IN Sources' as info,
    transaction_type,
    external_source,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_stock_in
FROM external_inventory_management
WHERE quantity > 0  -- Only stock IN
GROUP BY transaction_type, external_source
ORDER BY total_stock_in DESC;

-- Step 9: Make sure the approval function still works for adjustments
-- Keep the original approval function that creates adjustment transactions
CREATE OR REPLACE FUNCTION approve_external_stock_adjustment(
    p_adjustment_id UUID,
    p_reviewer_id UUID,
    p_reviewer_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    adj_record RECORD;
    adjustment_applied BOOLEAN := FALSE;
BEGIN
    -- Get the adjustment record
    SELECT * INTO adj_record
    FROM public.external_stock_adjustments
    WHERE id = p_adjustment_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Adjustment not found or already processed';
    END IF;
    
    -- Update the adjustment status
    UPDATE public.external_stock_adjustments
    SET 
        status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_by_name = p_reviewer_name,
        reviewed_at = NOW()
    WHERE id = p_adjustment_id;
    
    -- Apply the adjustment to external_inventory_management
    -- This allows both positive (stock IN) and negative (stock OUT) adjustments
    INSERT INTO public.external_inventory_management (
        product_name,
        product_code,
        color,
        size,
        category,
        unit_price,
        transaction_type,
        transaction_id,
        quantity,
        reference_name,
        agency_id,
        user_name,
        notes,
        external_source,
        external_reference
    ) VALUES (
        adj_record.product_name,
        adj_record.product_code,
        adj_record.color,
        adj_record.size,
        adj_record.category,
        adj_record.unit_price,
        'adjustment',  -- Keep as adjustment type
        'ADJ-' || adj_record.id::TEXT,
        adj_record.adjustment_quantity,  -- Can be positive or negative
        adj_record.reason,
        adj_record.agency_id,
        p_reviewer_name,
        COALESCE(adj_record.notes, '') || ' (Approved by ' || p_reviewer_name || ')',
        'approval',
        'Stock Adjustment Request #' || adj_record.id::TEXT
    );
    
    adjustment_applied := TRUE;
    
    RETURN adjustment_applied;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback the status update if inventory insert fails
        UPDATE public.external_stock_adjustments
        SET 
            status = 'pending',
            reviewed_by = NULL,
            reviewed_by_name = NULL,
            reviewed_at = NULL
        WHERE id = p_adjustment_id;
        
        RAISE EXCEPTION 'Failed to approve adjustment: %', SQLERRM;
END;
$$;

-- Step 10: Final verification - show all stock IN sources
SELECT 
    'Final Stock IN Summary' as info,
    transaction_type,
    COUNT(*) as transactions,
    SUM(quantity) as total_stock_in,
    COUNT(DISTINCT product_name) as unique_products
FROM external_inventory_management
WHERE quantity > 0
GROUP BY transaction_type
ORDER BY total_stock_in DESC;

-- Step 11: Show total stock balance
SELECT 
    'Final Stock Balance' as info,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
    SUM(quantity) as net_stock
FROM external_inventory_management;

COMMIT;