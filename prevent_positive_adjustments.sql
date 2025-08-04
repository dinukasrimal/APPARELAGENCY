-- Script to prevent positive stock adjustments from adding inventory

-- Option 1: Block ALL adjustments from creating inventory transactions
-- Adjustments become approval-only for record keeping
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
    
    -- Check if this is a positive adjustment (would add stock)
    IF adj_record.adjustment_quantity > 0 THEN
        RAISE EXCEPTION 'Positive stock adjustments are not allowed. Stock can only be added through external invoices or customer returns.';
    END IF;
    
    -- Update the adjustment status
    UPDATE public.external_stock_adjustments
    SET 
        status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_by_name = p_reviewer_name,
        reviewed_at = NOW()
    WHERE id = p_adjustment_id;
    
    -- Only create inventory transaction for NEGATIVE adjustments (stock reductions)
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
            'company_return',  -- Use company_return for negative adjustments (stock OUT)
            'ADJ-' || adj_record.id::TEXT,
            adj_record.adjustment_quantity,  -- This is negative (stock OUT)
            adj_record.reason,
            adj_record.agency_id,
            p_reviewer_name,
            COALESCE(adj_record.notes, '') || ' (Stock reduction approved by ' || p_reviewer_name || ')',
            'adjustment_correction',
            'Stock Reduction Request #' || adj_record.id::TEXT
        );
    END IF;
    
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

-- Alternative Option 2: Modify the UI to prevent positive adjustments from being submitted
-- Add a check constraint to the external_stock_adjustments table
ALTER TABLE external_stock_adjustments 
ADD CONSTRAINT no_positive_adjustments 
CHECK (adjustment_quantity <= 0);

-- Add helpful comment
COMMENT ON CONSTRAINT no_positive_adjustments ON external_stock_adjustments IS 
'Prevents positive stock adjustments. Stock can only be added through external invoices or customer returns.';

-- Option 3: Modify the bulk adjustment form to prevent positive adjustments
-- This would need to be done in the React component
-- But we can add a database trigger as backup

CREATE OR REPLACE FUNCTION prevent_positive_adjustments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.adjustment_quantity > 0 THEN
        RAISE EXCEPTION 'Positive stock adjustments are not allowed. Stock can only be added through external invoices or customer returns.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_positive_adjustments_trigger
    BEFORE INSERT OR UPDATE ON external_stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_positive_adjustments();

-- Show existing positive adjustments that would be blocked
SELECT 
    'Existing positive adjustments that would be blocked' as info,
    id,
    product_name,
    adjustment_quantity,
    reason,
    status,
    requested_by_name,
    requested_at
FROM external_stock_adjustments
WHERE adjustment_quantity > 0
ORDER BY requested_at DESC;

-- Update comments
COMMENT ON FUNCTION approve_external_stock_adjustment IS 
'Approves stock adjustments. Only allows negative adjustments (stock reductions). Positive adjustments are blocked to prevent unwanted stock IN.';

COMMIT;