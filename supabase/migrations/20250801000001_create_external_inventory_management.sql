-- Create external_inventory_management table for standalone inventory system
-- This table handles ALL inventory operations: external invoices, GRNs, sales, returns, adjustments

CREATE TABLE IF NOT EXISTS public.external_inventory_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Product Information (standalone, no dependency on products table)
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100), -- like [CV90], [BWS], [SW38], etc.
    color VARCHAR(100) NOT NULL DEFAULT 'Default',
    size VARCHAR(100) NOT NULL DEFAULT 'Default',
    category VARCHAR(100),
    sub_category VARCHAR(100),
    unit_price DECIMAL(12,2) DEFAULT 0,
    
    -- Transaction Details
    transaction_type VARCHAR(50) NOT NULL CHECK (
        transaction_type IN (
            'external_invoice',  -- Stock IN from external bot (+)
            'grn',              -- Stock IN from GRN acceptance (+)
            'customer_return',  -- Stock IN from customer returns (+)
            'sale',             -- Stock OUT to customers (-)
            'company_return',   -- Stock OUT as company returns (-)
            'adjustment'        -- Manual stock adjustments (+/-)
        )
    ),
    transaction_id VARCHAR(255), -- Reference to original invoice/order/GRN
    quantity INTEGER NOT NULL,   -- Positive for IN, Negative for OUT
    reference_name VARCHAR(255), -- Customer name, GRN number, invoice number, etc.
    
    -- Agency & User Info
    agency_id UUID NOT NULL,
    user_id UUID, -- Who made the transaction
    user_name VARCHAR(255), -- User name for reference
    
    -- Dates & Metadata
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT, -- Store order_lines JSON or additional transaction info
    
    -- External Source Info
    external_source VARCHAR(100) DEFAULT 'manual', -- 'bot', 'manual', 'grn', 'pos', etc.
    external_id VARCHAR(255), -- Original external invoice ID
    external_reference VARCHAR(255), -- Additional external reference
    
    -- Computed fields for easy querying
    is_stock_in BOOLEAN GENERATED ALWAYS AS (quantity > 0) STORED,
    absolute_quantity INTEGER GENERATED ALWAYS AS (ABS(quantity)) STORED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ext_inv_product_lookup 
ON public.external_inventory_management(product_name, color, size, agency_id);

CREATE INDEX IF NOT EXISTS idx_ext_inv_agency_id 
ON public.external_inventory_management(agency_id);

CREATE INDEX IF NOT EXISTS idx_ext_inv_transaction_type 
ON public.external_inventory_management(transaction_type);

CREATE INDEX IF NOT EXISTS idx_ext_inv_transaction_date 
ON public.external_inventory_management(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_ext_inv_user_id 
ON public.external_inventory_management(user_id);

CREATE INDEX IF NOT EXISTS idx_ext_inv_external_source 
ON public.external_inventory_management(external_source);

CREATE INDEX IF NOT EXISTS idx_ext_inv_reference_name 
ON public.external_inventory_management(reference_name);

-- Create composite index for stock calculations
CREATE INDEX IF NOT EXISTS idx_ext_inv_stock_calc 
ON public.external_inventory_management(agency_id, product_name, color, size, transaction_date);

-- Enable RLS
ALTER TABLE public.external_inventory_management ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agency-based access
CREATE POLICY "Users can view inventory from their agency" 
ON public.external_inventory_management
FOR SELECT USING (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert inventory for their agency" 
ON public.external_inventory_management
FOR INSERT WITH CHECK (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update inventory from their agency" 
ON public.external_inventory_management
FOR UPDATE USING (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

-- Superusers can access all data
CREATE POLICY "Superusers can access all inventory data" 
ON public.external_inventory_management
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'superuser'
    )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_external_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_external_inventory_updated_at_trigger
    BEFORE UPDATE ON public.external_inventory_management
    FOR EACH ROW
    EXECUTE FUNCTION update_external_inventory_updated_at();

-- Create useful views for stock calculations
CREATE OR REPLACE VIEW public.external_inventory_stock_summary AS
SELECT 
    agency_id,
    product_name,
    product_code,
    color,
    size,
    category,
    sub_category,
    AVG(unit_price) as avg_unit_price, -- Average price across transactions
    SUM(quantity) as current_stock,
    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_stock_in,
    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_stock_out,
    COUNT(*) as transaction_count,
    MAX(transaction_date) as last_transaction_date,
    MIN(transaction_date) as first_transaction_date
FROM public.external_inventory_management
GROUP BY agency_id, product_name, product_code, color, size, category, sub_category
HAVING SUM(quantity) <> 0 -- Only show items with stock
ORDER BY product_name, color, size;

-- Create view for transaction history
CREATE OR REPLACE VIEW public.external_inventory_transactions AS
SELECT 
    id,
    product_name,
    product_code,
    color,
    size,
    category,
    transaction_type,
    quantity,
    CASE 
        WHEN quantity > 0 THEN 'IN'
        WHEN quantity < 0 THEN 'OUT'
        ELSE 'ZERO'
    END as movement_type,
    reference_name,
    user_name,
    transaction_date,
    external_source,
    external_id,
    notes,
    agency_id
FROM public.external_inventory_management
ORDER BY transaction_date DESC;

-- Create view for stock movements by transaction type
CREATE OR REPLACE VIEW public.external_inventory_by_type AS
SELECT 
    agency_id,
    product_name,
    color,
    size,
    transaction_type,
    SUM(quantity) as net_quantity,
    COUNT(*) as transaction_count,
    AVG(unit_price) as avg_price,
    MAX(transaction_date) as last_transaction
FROM public.external_inventory_management
GROUP BY agency_id, product_name, color, size, transaction_type
ORDER BY product_name, transaction_type;

-- Grant permissions
GRANT ALL ON public.external_inventory_management TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.external_inventory_management TO authenticated;
GRANT SELECT ON public.external_inventory_stock_summary TO authenticated;
GRANT SELECT ON public.external_inventory_transactions TO authenticated;
GRANT SELECT ON public.external_inventory_by_type TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.external_inventory_management IS 'Standalone inventory management system handling all stock operations';
COMMENT ON COLUMN public.external_inventory_management.transaction_type IS 'Type of inventory transaction: external_invoice, grn, customer_return, sale, company_return, adjustment';
COMMENT ON COLUMN public.external_inventory_management.quantity IS 'Transaction quantity: positive for stock IN, negative for stock OUT';
COMMENT ON COLUMN public.external_inventory_management.reference_name IS 'Reference like customer name, invoice number, GRN number';
COMMENT ON COLUMN public.external_inventory_management.notes IS 'Additional data like order_lines JSON or transaction details';

-- Create function to get current stock for a product
CREATE OR REPLACE FUNCTION get_external_inventory_stock(
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

GRANT EXECUTE ON FUNCTION get_external_inventory_stock TO authenticated;