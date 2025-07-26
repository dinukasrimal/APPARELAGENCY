-- Fix external_invoices table schema
-- Add date_order column if it doesn't exist

DO $$ 
BEGIN
    -- Check if date_order column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'external_invoices' 
        AND column_name = 'date_order'
    ) THEN
        ALTER TABLE public.external_invoices 
        ADD COLUMN date_order DATE NOT NULL DEFAULT '2024-01-01';
    END IF;
END $$;

-- Also ensure the table exists with correct structure
CREATE TABLE IF NOT EXISTS public.external_invoices (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    partner_name TEXT NOT NULL,
    date_order DATE NOT NULL DEFAULT '2024-01-01',
    amount_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    state TEXT,
    order_lines JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CHECK (amount_total >= 0)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_external_invoices_partner_name ON public.external_invoices(partner_name);
CREATE INDEX IF NOT EXISTS idx_external_invoices_date_order ON public.external_invoices(date_order DESC);
CREATE INDEX IF NOT EXISTS idx_external_invoices_state ON public.external_invoices(state);
CREATE INDEX IF NOT EXISTS idx_external_invoices_amount ON public.external_invoices(amount_total DESC);

-- Enable RLS if not already enabled
ALTER TABLE public.external_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
    -- Check if policy exists before creating
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'external_invoices' 
        AND policyname = 'Users can view external invoices for their agency'
    ) THEN
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
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'external_invoices' 
        AND policyname = 'Superusers can manage external invoices'
    ) THEN
        CREATE POLICY "Superusers can manage external invoices" 
            ON public.external_invoices 
            FOR ALL
            USING (
                (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
            );
    END IF;
END $$;