-- Create stock adjustments table for agency submissions and superuser approvals
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  current_stock INTEGER NOT NULL, -- Stock level at time of request
  new_stock INTEGER NOT NULL, -- Expected stock level after adjustment
  reason TEXT NOT NULL,
  justification TEXT, -- Additional details for the adjustment
  
  -- Request information
  requested_by UUID NOT NULL REFERENCES profiles(id),
  agency_id UUID NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Approval information
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_stock_adjustments_agency_id ON stock_adjustments(agency_id);
CREATE INDEX idx_stock_adjustments_status ON stock_adjustments(status);
CREATE INDEX idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_requested_at ON stock_adjustments(requested_at DESC);

-- Enable RLS
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Agencies can view and create their own adjustments
CREATE POLICY "Agencies can manage their adjustments" ON stock_adjustments
  FOR ALL USING (
    agency_id = (
      SELECT agency_id FROM profiles 
      WHERE id = auth.uid()
    )
    OR auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'superuser'
    )
  );

-- Superusers can view and approve all adjustments
CREATE POLICY "Superusers can manage all adjustments" ON stock_adjustments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'superuser'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_adjustments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_stock_adjustments_updated_at
  BEFORE UPDATE ON stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_adjustments_updated_at();

-- Create function to automatically create inventory transaction when adjustment is approved
CREATE OR REPLACE FUNCTION process_approved_stock_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Calculate the actual quantity for the transaction
    -- For increases: positive quantity, for decreases: negative quantity
    DECLARE
      transaction_quantity INTEGER;
    BEGIN
      IF NEW.adjustment_type = 'increase' THEN
        transaction_quantity := NEW.quantity;
      ELSE
        transaction_quantity := -NEW.quantity;
      END IF;

      -- Create inventory transaction
      INSERT INTO inventory_transactions (
        product_id,
        product_name,
        color,
        size,
        transaction_type,
        quantity,
        reference_id,
        reference_name,
        user_id,
        agency_id,
        notes
      ) VALUES (
        NEW.product_id,
        NEW.product_name,
        NEW.color,
        NEW.size,
        'adjustment',
        transaction_quantity,
        NEW.id::text,
        'Stock Adjustment #' || NEW.id,
        NEW.reviewed_by,
        NEW.agency_id,
        'Approved stock adjustment: ' || NEW.reason || 
        CASE WHEN NEW.review_notes IS NOT NULL 
             THEN ' | Review notes: ' || NEW.review_notes 
             ELSE '' 
        END
      );

      RAISE NOTICE 'Created inventory transaction for approved stock adjustment: %', NEW.id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for approved adjustments
CREATE TRIGGER process_approved_stock_adjustment_trigger
  AFTER UPDATE ON stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION process_approved_stock_adjustment();

-- Add some common adjustment reasons as reference
CREATE TABLE stock_adjustment_reasons (
  id SERIAL PRIMARY KEY,
  reason TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common adjustment reasons
INSERT INTO stock_adjustment_reasons (reason, description) VALUES
('Damaged Goods', 'Items damaged during storage or handling'),
('Lost Items', 'Items that cannot be located in inventory'),
('Theft', 'Items reported as stolen'),
('Counting Error', 'Correction of previous counting mistakes'),
('Return Processing', 'Items returned from customers not yet processed'),
('Quality Issues', 'Items with quality defects that cannot be sold'),
('Expired Items', 'Items that have passed their shelf life'),
('Supplier Error', 'Correction due to supplier delivery discrepancies'),
('Found Items', 'Items found that were previously thought lost'),
('Other', 'Other reason not listed above');

-- Enable RLS for reasons table
ALTER TABLE stock_adjustment_reasons ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read reasons
CREATE POLICY "All users can read adjustment reasons" ON stock_adjustment_reasons
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superusers can manage reasons
CREATE POLICY "Superusers can manage adjustment reasons" ON stock_adjustment_reasons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'superuser'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE stock_adjustments IS 'Stock adjustment requests submitted by agencies and approved by superusers';
COMMENT ON COLUMN stock_adjustments.current_stock IS 'Stock level at the time of request submission';
COMMENT ON COLUMN stock_adjustments.new_stock IS 'Expected stock level after adjustment is applied';
COMMENT ON COLUMN stock_adjustments.status IS 'pending: awaiting review, approved: adjustment applied, rejected: adjustment denied';
COMMENT ON TRIGGER process_approved_stock_adjustment_trigger ON stock_adjustments IS 'Automatically creates inventory transaction when adjustment is approved';