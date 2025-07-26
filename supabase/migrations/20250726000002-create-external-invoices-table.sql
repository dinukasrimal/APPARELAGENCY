-- Create external_invoices table
-- This table stores invoices from external system with partner_name matching agency names
CREATE TABLE public.external_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT,
    partner_name TEXT NOT NULL, -- This will match agency names
    invoice_date DATE NOT NULL,
    product_category TEXT,
    product_name TEXT,
    quantity DECIMAL(10,2) DEFAULT 0,
    unit_price DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'LKR',
    status TEXT DEFAULT 'posted',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Add constraints
    CHECK (quantity >= 0),
    CHECK (unit_price >= 0),
    CHECK (total_amount >= 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_external_invoices_partner_name ON public.external_invoices(partner_name);
CREATE INDEX idx_external_invoices_invoice_date ON public.external_invoices(invoice_date DESC);
CREATE INDEX idx_external_invoices_product_category ON public.external_invoices(product_category);
CREATE INDEX idx_external_invoices_status ON public.external_invoices(status);
CREATE INDEX idx_external_invoices_created_at ON public.external_invoices(created_at DESC);
CREATE INDEX idx_external_invoices_quarter_lookup ON public.external_invoices(
    partner_name, 
    product_category, 
    EXTRACT(QUARTER FROM invoice_date), 
    EXTRACT(YEAR FROM invoice_date)
);

-- Enable Row Level Security
ALTER TABLE public.external_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view invoices for their agency (matching by agency name)
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

-- RLS Policy: Superusers can insert invoices for any agency
CREATE POLICY "Superusers can create external invoices" 
    ON public.external_invoices 
    FOR INSERT 
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Superusers can update invoices
CREATE POLICY "Superusers can update external invoices" 
    ON public.external_invoices 
    FOR UPDATE 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Superusers can delete invoices
CREATE POLICY "Superusers can delete external invoices" 
    ON public.external_invoices 
    FOR DELETE 
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- Create trigger for updated_at
CREATE TRIGGER update_external_invoices_updated_at
    BEFORE UPDATE ON public.external_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();