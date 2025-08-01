-- Migration to create external_bot_project_invoices table and sync data from external database
-- This will copy the invoices table structure and data from the external database

-- Create the external_bot_project_invoices table
CREATE TABLE IF NOT EXISTS public.external_bot_project_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(255),
    customer_id INTEGER,
    customer_name VARCHAR(255),
    invoice_date DATE,
    due_date DATE,
    subtotal DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    status VARCHAR(50),
    payment_status VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Add any other fields that might exist in the external invoices table
    agency_id INTEGER,
    sales_rep_id INTEGER,
    billing_address TEXT,
    shipping_address TEXT,
    terms_conditions TEXT,
    currency VARCHAR(10) DEFAULT 'LKR'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_external_bot_invoices_customer_id ON public.external_bot_project_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_external_bot_invoices_invoice_date ON public.external_bot_project_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_external_bot_invoices_status ON public.external_bot_project_invoices(status);
CREATE INDEX IF NOT EXISTS idx_external_bot_invoices_payment_status ON public.external_bot_project_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_external_bot_invoices_agency_id ON public.external_bot_project_invoices(agency_id);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE public.external_bot_project_invoices ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access based on user role
CREATE POLICY "Allow read access to external bot invoices" ON public.external_bot_project_invoices
    FOR SELECT USING (true);

-- Create policy to allow insert/update for authorized users
CREATE POLICY "Allow insert/update for authorized users" ON public.external_bot_project_invoices
    FOR ALL USING (true);

-- Create a function to sync data from external database
-- Note: You'll need to replace the connection details with your actual external database credentials
CREATE OR REPLACE FUNCTION sync_external_bot_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function will use the foreign data wrapper to sync data
    -- First, we need to create a foreign data wrapper connection
    
    -- Create extension if not exists (requires superuser privileges)
    -- CREATE EXTENSION IF NOT EXISTS postgres_fdw;
    
    -- Create foreign server (replace with your actual external database details)
    -- You'll need to update these connection parameters with your actual values
    /*
    CREATE SERVER IF NOT EXISTS external_bot_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (
        host 'your-external-host.com',
        port '5432',
        dbname 'your-external-database-name'
    );
    
    -- Create user mapping (replace with actual credentials)
    CREATE USER MAPPING IF NOT EXISTS FOR current_user
    SERVER external_bot_server
    OPTIONS (
        user 'your-external-username',
        password 'your-external-password'
    );
    
    -- Create foreign table
    CREATE FOREIGN TABLE IF NOT EXISTS external_invoices (
        id INTEGER,
        invoice_number VARCHAR(255),
        customer_id INTEGER,
        customer_name VARCHAR(255),
        invoice_date DATE,
        due_date DATE,
        subtotal DECIMAL(10,2),
        tax_amount DECIMAL(10,2),
        discount_amount DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        status VARCHAR(50),
        payment_status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        agency_id INTEGER,
        sales_rep_id INTEGER,
        billing_address TEXT,
        shipping_address TEXT,
        terms_conditions TEXT,
        currency VARCHAR(10)
    )
    SERVER external_bot_server
    OPTIONS (schema_name 'public', table_name 'invoices');
    
    -- Clear existing data and insert fresh data from external source
    TRUNCATE TABLE public.external_bot_project_invoices;
    
    -- Insert data from external table
    INSERT INTO public.external_bot_project_invoices (
        invoice_number, customer_id, customer_name, invoice_date, due_date,
        subtotal, tax_amount, discount_amount, total_amount, status,
        payment_status, notes, created_at, updated_at, agency_id,
        sales_rep_id, billing_address, shipping_address, terms_conditions, currency
    )
    SELECT 
        invoice_number, customer_id, customer_name, invoice_date, due_date,
        subtotal, tax_amount, discount_amount, total_amount, status,
        payment_status, notes, created_at, updated_at, agency_id,
        sales_rep_id, billing_address, shipping_address, terms_conditions, 
        COALESCE(currency, 'LKR')
    FROM external_invoices;
    */
    
    -- For now, we'll create a placeholder that logs the sync attempt
    RAISE NOTICE 'External bot invoices sync function created. Please configure foreign data wrapper manually.';
    
END;
$$;

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_external_bot_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_external_bot_invoices_updated_at_trigger
    BEFORE UPDATE ON public.external_bot_project_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_external_bot_invoices_updated_at();

-- Add comments to the table and columns
COMMENT ON TABLE public.external_bot_project_invoices IS 'Invoices synced from external bot project database';
COMMENT ON COLUMN public.external_bot_project_invoices.id IS 'Primary key for the synced invoice record';
COMMENT ON COLUMN public.external_bot_project_invoices.invoice_number IS 'Invoice number from external system';
COMMENT ON COLUMN public.external_bot_project_invoices.customer_id IS 'Customer ID from external system';
COMMENT ON COLUMN public.external_bot_project_invoices.total_amount IS 'Total invoice amount in the specified currency';
COMMENT ON COLUMN public.external_bot_project_invoices.status IS 'Invoice status (draft, sent, paid, cancelled, etc.)';
COMMENT ON COLUMN public.external_bot_project_invoices.payment_status IS 'Payment status (unpaid, partial, paid, overdue)';

-- Grant necessary permissions
GRANT ALL ON public.external_bot_project_invoices TO authenticated;
GRANT ALL ON public.external_bot_project_invoices TO service_role;