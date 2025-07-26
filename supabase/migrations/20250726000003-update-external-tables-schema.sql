-- Update external tables to match source data structure

-- Drop existing external tables and recreate with correct schema
DROP TABLE IF EXISTS public.external_invoices CASCADE;
DROP TABLE IF EXISTS public.external_sales_targets CASCADE;

-- Create external_invoices table matching your source invoices structure
CREATE TABLE public.external_invoices (
    id TEXT NOT NULL PRIMARY KEY,  -- Using TEXT to match your source
    name TEXT,
    partner_name TEXT NOT NULL,  -- This matches agency names
    date_order DATE NOT NULL,
    amount_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    state TEXT,
    order_lines JSONB,  -- Store order lines as JSON
    
    -- Additional fields for our system
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Constraints
    CHECK (amount_total >= 0)
);

-- Create external_sales_targets table matching your source sales_targets structure  
CREATE TABLE public.external_sales_targets (
    id TEXT NOT NULL PRIMARY KEY,  -- Using TEXT to match your source
    customer_name TEXT NOT NULL,  -- This matches agency names
    target_year INTEGER NOT NULL,
    target_months TEXT,  -- Store as text (e.g., "Q1", "Jan-Mar", etc.)
    base_year INTEGER,
    target_data JSONB,  -- Store target data as JSON
    initial_total_value DECIMAL(15,2) DEFAULT 0,
    adjusted_total_value DECIMAL(15,2) DEFAULT 0,
    percentage_increase DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by TEXT,
    
    -- Constraints
    CHECK (initial_total_value >= 0),
    CHECK (adjusted_total_value >= 0),
    CHECK (percentage_increase >= -100)  -- Can be negative for decreases
);

-- Create indexes for better query performance
CREATE INDEX idx_external_invoices_partner_name ON public.external_invoices(partner_name);
CREATE INDEX idx_external_invoices_date_order ON public.external_invoices(date_order DESC);
CREATE INDEX idx_external_invoices_state ON public.external_invoices(state);
CREATE INDEX idx_external_invoices_amount ON public.external_invoices(amount_total DESC);

CREATE INDEX idx_external_sales_targets_customer_name ON public.external_sales_targets(customer_name);
CREATE INDEX idx_external_sales_targets_year ON public.external_sales_targets(target_year);
CREATE INDEX idx_external_sales_targets_months ON public.external_sales_targets(target_months);
CREATE INDEX idx_external_sales_targets_values ON public.external_sales_targets(adjusted_total_value DESC);

-- Enable Row Level Security
ALTER TABLE public.external_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_sales_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for external_invoices
CREATE POLICY "Users can view external invoices for their agency" 
    ON public.external_invoices 
    FOR SELECT 
    USING (
        partner_name = (
            SELECT name FROM public.agencies 
            WHERE id = (
                SELECT agency_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

CREATE POLICY "Superusers can manage external invoices" 
    ON public.external_invoices 
    FOR ALL
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policies for external_sales_targets  
CREATE POLICY "Users can view external sales targets for their agency" 
    ON public.external_sales_targets 
    FOR SELECT 
    USING (
        customer_name = (
            SELECT name FROM public.agencies 
            WHERE id = (
                SELECT agency_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

CREATE POLICY "Superusers can manage external sales targets" 
    ON public.external_sales_targets 
    FOR ALL
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- Create trigger for updated_at on both tables
CREATE TRIGGER update_external_invoices_updated_at
    BEFORE UPDATE ON public.external_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_sales_targets_updated_at
    BEFORE UPDATE ON public.external_sales_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();