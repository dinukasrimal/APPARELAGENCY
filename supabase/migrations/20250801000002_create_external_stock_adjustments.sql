-- Create external stock adjustments table for approval workflow
-- This table handles stock adjustment requests that require approval before being applied to external_inventory_management

CREATE TABLE IF NOT EXISTS public.external_stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Product Information
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100),
    color VARCHAR(100) NOT NULL DEFAULT 'Default',
    size VARCHAR(100) NOT NULL DEFAULT 'Default',
    category VARCHAR(100),
    
    -- Stock Information
    current_stock INTEGER NOT NULL DEFAULT 0,
    adjustment_quantity INTEGER NOT NULL, -- Can be positive or negative
    new_stock INTEGER NOT NULL, -- current_stock + adjustment_quantity
    unit_price DECIMAL(12,2) DEFAULT 0,
    
    -- Request Details
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    adjustment_type VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (
        adjustment_type IN ('manual', 'bulk', 'correction', 'damage', 'loss', 'found')
    ),
    
    -- Workflow Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'cancelled')
    ),
    
    -- User Information
    agency_id UUID NOT NULL,
    requested_by UUID NOT NULL, -- User who requested the adjustment
    requested_by_name VARCHAR(255) NOT NULL,
    reviewed_by UUID, -- User who approved/rejected
    reviewed_by_name VARCHAR(255),
    
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Batch Information (for bulk adjustments)
    batch_id UUID, -- Groups multiple adjustments together
    batch_name VARCHAR(255),
    
    -- Reference Information
    reference_id VARCHAR(255), -- Reference to external document/reason
    external_source VARCHAR(100) DEFAULT 'manual'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_agency_id 
ON public.external_stock_adjustments(agency_id);

CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_status 
ON public.external_stock_adjustments(status);

CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_requested_by 
ON public.external_stock_adjustments(requested_by);

CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_reviewed_by 
ON public.external_stock_adjustments(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_batch_id 
ON public.external_stock_adjustments(batch_id);

CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_product_lookup 
ON public.external_stock_adjustments(product_name, color, size, agency_id);

CREATE INDEX IF NOT EXISTS idx_ext_stock_adj_requested_at 
ON public.external_stock_adjustments(requested_at DESC);

-- Enable RLS
ALTER TABLE public.external_stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view adjustments from their agency" 
ON public.external_stock_adjustments
FOR SELECT USING (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert adjustments for their agency" 
ON public.external_stock_adjustments
FOR INSERT WITH CHECK (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update their own adjustment requests" 
ON public.external_stock_adjustments
FOR UPDATE USING (
    requested_by = auth.uid() AND status = 'pending'
);

-- Superusers can access and modify all adjustments
CREATE POLICY "Superusers can access all adjustments" 
ON public.external_stock_adjustments
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'superuser'
    )
);

-- Superusers can approve/reject adjustments
CREATE POLICY "Superusers can review adjustments" 
ON public.external_stock_adjustments
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'superuser'
    )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_external_stock_adjustments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_external_stock_adjustments_updated_at_trigger
    BEFORE UPDATE ON public.external_stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_external_stock_adjustments_updated_at();

-- Create views for easy querying
CREATE OR REPLACE VIEW public.external_stock_adjustments_pending AS
SELECT 
    id,
    product_name,
    product_code,
    color,
    size,
    category,
    current_stock,
    adjustment_quantity,
    new_stock,
    reason,
    notes,
    adjustment_type,
    requested_by_name,
    requested_at,
    batch_id,
    batch_name,
    agency_id
FROM public.external_stock_adjustments
WHERE status = 'pending'
ORDER BY requested_at ASC;

CREATE OR REPLACE VIEW public.external_stock_adjustments_history AS
SELECT 
    id,
    product_name,
    product_code,
    color,
    size,
    category,
    current_stock,
    adjustment_quantity,
    new_stock,
    reason,
    notes,
    adjustment_type,
    status,
    requested_by_name,
    reviewed_by_name,
    requested_at,
    reviewed_at,
    batch_id,
    batch_name,
    agency_id
FROM public.external_stock_adjustments
WHERE status IN ('approved', 'rejected')
ORDER BY reviewed_at DESC;

-- Create function to approve adjustment and apply to inventory
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
        'adjustment',
        'ADJ-' || adj_record.id::TEXT,
        adj_record.adjustment_quantity,
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
        
        RAISE EXCEPTION 'Failed to apply adjustment: %', SQLERRM;
END;
$$;

-- Create function to reject adjustment
CREATE OR REPLACE FUNCTION reject_external_stock_adjustment(
    p_adjustment_id UUID,
    p_reviewer_id UUID,
    p_reviewer_name TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the adjustment status
    UPDATE public.external_stock_adjustments
    SET 
        status = 'rejected',
        reviewed_by = p_reviewer_id,
        reviewed_by_name = p_reviewer_name,
        reviewed_at = NOW(),
        notes = COALESCE(notes, '') || ' | Rejected: ' || COALESCE(p_rejection_reason, 'No reason provided')
    WHERE id = p_adjustment_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Adjustment not found or already processed';
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Create function to get current stock from external inventory
CREATE OR REPLACE FUNCTION get_external_current_stock(
    p_agency_id UUID,
    p_product_name TEXT,
    p_color TEXT DEFAULT 'Default',
    p_size TEXT DEFAULT 'Default'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    SELECT COALESCE(SUM(quantity), 0)
    INTO current_stock
    FROM public.external_inventory_management
    WHERE agency_id = p_agency_id
      AND product_name = p_product_name
      AND color = p_color
      AND size = p_size;
    
    RETURN current_stock;
END;
$$;

-- Grant permissions
GRANT ALL ON public.external_stock_adjustments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.external_stock_adjustments TO authenticated;
GRANT SELECT ON public.external_stock_adjustments_pending TO authenticated;
GRANT SELECT ON public.external_stock_adjustments_history TO authenticated;
GRANT EXECUTE ON FUNCTION approve_external_stock_adjustment TO authenticated;
GRANT EXECUTE ON FUNCTION reject_external_stock_adjustment TO authenticated;
GRANT EXECUTE ON FUNCTION get_external_current_stock TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.external_stock_adjustments IS 'Stock adjustment requests for external inventory management with approval workflow';
COMMENT ON COLUMN public.external_stock_adjustments.adjustment_quantity IS 'Quantity to adjust: positive for increase, negative for decrease';
COMMENT ON COLUMN public.external_stock_adjustments.status IS 'Workflow status: pending, approved, rejected, cancelled';
COMMENT ON COLUMN public.external_stock_adjustments.batch_id IS 'Groups multiple adjustments together for bulk operations';
COMMENT ON FUNCTION approve_external_stock_adjustment IS 'Approves adjustment and applies it to external_inventory_management';
COMMENT ON FUNCTION reject_external_stock_adjustment IS 'Rejects adjustment request with optional reason';