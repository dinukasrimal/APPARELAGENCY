-- Migration to set up foreign data wrapper for external bot project database
-- This will create the connection to sync data from the external invoices table

-- Step 1: Create the postgres_fdw extension (requires superuser privileges)
-- This should be run by a database administrator
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Step 2: Create foreign server
-- Using the actual external Supabase database credentials found in the system
CREATE SERVER IF NOT EXISTS external_bot_server
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (
    host 'aws-0-ap-southeast-1.pooler.supabase.com',
    port '6543',
    dbname 'postgres'
);

-- Step 3: Create user mapping
-- Replace with your actual external database credentials
CREATE USER MAPPING IF NOT EXISTS FOR postgres
SERVER external_bot_server
OPTIONS (
    user 'your-external-username',
    password 'your-external-password'
);

-- Alternative user mapping for authenticated users
CREATE USER MAPPING IF NOT EXISTS FOR authenticated
SERVER external_bot_server
OPTIONS (
    user 'your-external-username',
    password 'your-external-password'
);

-- Step 4: Create foreign table that maps to the external invoices table
CREATE FOREIGN TABLE IF NOT EXISTS public.external_invoices_fdw (
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
OPTIONS (
    schema_name 'public', 
    table_name 'invoices'
);

-- Step 5: Update the sync function to actually sync data
CREATE OR REPLACE FUNCTION sync_external_bot_invoices()
RETURNS TABLE(
    synced_count INTEGER,
    sync_status TEXT,
    sync_timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    record_count INTEGER;
    sync_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    sync_start_time := NOW();
    
    BEGIN
        -- Clear existing data
        DELETE FROM public.external_bot_project_invoices;
        
        -- Insert fresh data from external source
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
        FROM public.external_invoices_fdw;
        
        -- Get the count of synced records
        GET DIAGNOSTICS record_count = ROW_COUNT;
        
        -- Return success status
        RETURN QUERY SELECT 
            record_count,
            'SUCCESS'::TEXT,
            sync_start_time;
            
    EXCEPTION WHEN OTHERS THEN
        -- Return error status
        RETURN QUERY SELECT 
            0,
            ('ERROR: ' || SQLERRM)::TEXT,
            sync_start_time;
    END;
END;
$$;

-- Step 6: Create a function to test the external connection
CREATE OR REPLACE FUNCTION test_external_connection()
RETURNS TABLE(
    connection_status TEXT,
    record_count BIGINT,
    sample_invoice_number VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_count BIGINT;
    sample_invoice VARCHAR(255);
BEGIN
    BEGIN
        -- Try to count records in external table
        SELECT COUNT(*) INTO test_count FROM public.external_invoices_fdw LIMIT 1000;
        
        -- Try to get a sample invoice number
        SELECT invoice_number INTO sample_invoice 
        FROM public.external_invoices_fdw 
        LIMIT 1;
        
        -- Return success
        RETURN QUERY SELECT 
            'CONNECTION_SUCCESS'::TEXT,
            test_count,
            COALESCE(sample_invoice, 'No records found'::VARCHAR(255));
            
    EXCEPTION WHEN OTHERS THEN
        -- Return error
        RETURN QUERY SELECT 
            ('CONNECTION_ERROR: ' || SQLERRM)::TEXT,
            0::BIGINT,
            'N/A'::VARCHAR(255);
    END;
END;
$$;

-- Step 7: Create a scheduled sync function (optional)
CREATE OR REPLACE FUNCTION schedule_external_sync()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- This function can be called by a cron job or scheduled task
    -- to automatically sync data at regular intervals
    PERFORM sync_external_bot_invoices();
    
    RAISE NOTICE 'External bot invoices sync completed at %', NOW();
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_external_bot_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION test_external_connection() TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_external_sync() TO authenticated;

-- Add comments
COMMENT ON FUNCTION sync_external_bot_invoices() IS 'Syncs invoice data from external bot project database';
COMMENT ON FUNCTION test_external_connection() IS 'Tests connection to external database and returns sample data';
COMMENT ON FUNCTION schedule_external_sync() IS 'Wrapper function for scheduled synchronization';

-- Create a view for easier access to external invoice data
CREATE OR REPLACE VIEW public.external_bot_invoices_view AS
SELECT 
    id,
    invoice_number,
    customer_name,
    invoice_date,
    total_amount,
    status,
    payment_status,
    currency,
    created_at,
    updated_at
FROM public.external_bot_project_invoices
ORDER BY invoice_date DESC, created_at DESC;

GRANT SELECT ON public.external_bot_invoices_view TO authenticated;