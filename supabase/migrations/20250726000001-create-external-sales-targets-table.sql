-- Create external_sales_targets table
-- This table stores sales targets from external system with customer_name matching agency names
CREATE TABLE public.external_sales_targets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL, -- This will match agency names
    product_category TEXT NOT NULL,
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    year INTEGER NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Add unique constraint to prevent duplicate targets
    UNIQUE(customer_name, product_category, quarter, year)
);

-- Create indexes for better query performance
CREATE INDEX idx_external_sales_targets_customer_name ON public.external_sales_targets(customer_name);
CREATE INDEX idx_external_sales_targets_quarter_year ON public.external_sales_targets(quarter, year);
CREATE INDEX idx_external_sales_targets_category ON public.external_sales_targets(product_category);
CREATE INDEX idx_external_sales_targets_created_at ON public.external_sales_targets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.external_sales_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view targets for their agency (matching by agency name)
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

-- RLS Policy: Superusers can insert targets for any agency
CREATE POLICY "Superusers can create external sales targets" 
    ON public.external_sales_targets 
    FOR INSERT 
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Superusers can update targets
CREATE POLICY "Superusers can update external sales targets" 
    ON public.external_sales_targets 
    FOR UPDATE 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Superusers can delete targets
CREATE POLICY "Superusers can delete external sales targets" 
    ON public.external_sales_targets 
    FOR DELETE 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_external_sales_targets_updated_at
    BEFORE UPDATE ON public.external_sales_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();