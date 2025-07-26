-- Create customer_assets table
CREATE TABLE public.customer_assets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    asset_type TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    given_by TEXT NOT NULL,
    
    -- Add foreign key constraint to customers table
    CONSTRAINT fk_customer_assets_customer_id 
        FOREIGN KEY (customer_id) 
        REFERENCES public.customers(id) 
        ON DELETE CASCADE
);

-- Create index for better query performance
CREATE INDEX idx_customer_assets_customer_id ON public.customer_assets(customer_id);
CREATE INDEX idx_customer_assets_created_at ON public.customer_assets(created_at DESC);
CREATE INDEX idx_customer_assets_asset_type ON public.customer_assets(asset_type);

-- Enable Row Level Security
ALTER TABLE public.customer_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view assets for customers in their agency
CREATE POLICY "Users can view customer assets for their agency" 
    ON public.customer_assets 
    FOR SELECT 
    USING (
        customer_id IN (
            SELECT id FROM public.customers 
            WHERE agency_id = (
                SELECT agency_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Users can insert assets for customers in their agency
CREATE POLICY "Users can create customer assets for their agency" 
    ON public.customer_assets 
    FOR INSERT 
    WITH CHECK (
        customer_id IN (
            SELECT id FROM public.customers 
            WHERE agency_id = (
                SELECT agency_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Users can update assets for customers in their agency
CREATE POLICY "Users can update customer assets for their agency" 
    ON public.customer_assets 
    FOR UPDATE 
    USING (
        customer_id IN (
            SELECT id FROM public.customers 
            WHERE agency_id = (
                SELECT agency_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );

-- RLS Policy: Users can delete assets for customers in their agency
CREATE POLICY "Users can delete customer assets for their agency" 
    ON public.customer_assets 
    FOR DELETE 
    USING (
        customer_id IN (
            SELECT id FROM public.customers 
            WHERE agency_id = (
                SELECT agency_id FROM public.profiles 
                WHERE id = auth.uid()
            )
        )
        OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
    );