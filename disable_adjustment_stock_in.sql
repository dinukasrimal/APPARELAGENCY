-- Script to modify the approval function to prevent stock IN from adjustments

-- Option 1: Completely disable inventory transactions from adjustments
-- Replace the approval function to NOT create inventory transactions
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
    
    -- Update the adjustment status ONLY - DO NOT create inventory transaction
    UPDATE public.external_stock_adjustments
    SET 
        status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_by_name = p_reviewer_name,
        reviewed_at = NOW()
    WHERE id = p_adjustment_id;
    
    -- Note: We are NOT creating inventory transactions for adjustments
    -- Adjustments are now approval-only for record keeping
    
    adjustment_applied := TRUE;
    
    RETURN adjustment_applied;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback the status update if there's an error
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

-- Option 2: Alternative - Only allow negative adjustments (stock OUT corrections)
-- Uncomment this if you want to allow stock corrections that reduce stock only
/*
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
    
    -- Only create inventory transaction for NEGATIVE adjustments (stock OUT corrections)
    IF adj_record.adjustment_quantity < 0 THEN
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
            'company_return',  -- Use company_return for negative adjustments
            'ADJ-' || adj_record.id::TEXT,
            adj_record.adjustment_quantity,  -- This will be negative
            adj_record.reason,
            adj_record.agency_id,
            p_reviewer_name,
            COALESCE(adj_record.notes, '') || ' (Stock correction approved by ' || p_reviewer_name || ')',
            'adjustment_correction',
            'Stock Correction Request #' || adj_record.id::TEXT
        );
    END IF;
    
    -- Positive adjustments are approved but don't create inventory transactions
    
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
*/

-- Add comment explaining the change
COMMENT ON FUNCTION approve_external_stock_adjustment IS 
'Approves stock adjustments but does NOT create inventory transactions to prevent unwanted stock IN. Adjustments are for record keeping only.';

-- Show current function definition for verification
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'approve_external_stock_adjustment';

COMMIT;