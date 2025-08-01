-- Migration to create external_bot_project_invoices table and sync from actual external Supabase database
-- Using the credentials already in the system: https://tnduapjjyqhppclgnqsb.supabase.co

-- Create the external_bot_project_invoices table
CREATE TABLE IF NOT EXISTS public.external_bot_project_invoices (
    id BIGINT PRIMARY KEY,
    invoice_number VARCHAR(255),
    customer_id BIGINT,
    customer_name VARCHAR(255),
    partner_name VARCHAR(255),
    date_order TIMESTAMP WITH TIME ZONE,
    amount_total DECIMAL(15,2),
    state VARCHAR(100),
    payment_state VARCHAR(100),
    currency_id VARCHAR(10),
    notes TEXT,
    order_lines JSONB,
    agency_match VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Additional fields from the external system
    company_id BIGINT,
    user_id BIGINT,
    team_id BIGINT,
    date_invoice TIMESTAMP WITH TIME ZONE,
    invoice_date TIMESTAMP WITH TIME ZONE,
    invoice_payment_term_id BIGINT,
    fiscal_position_id BIGINT,
    invoice_origin VARCHAR(255),
    reference VARCHAR(255),
    move_type VARCHAR(50),
    journal_id BIGINT,
    auto_post BOOLEAN DEFAULT FALSE,
    to_check BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_customer_id ON public.external_bot_project_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_date_order ON public.external_bot_project_invoices(date_order);
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_state ON public.external_bot_project_invoices(state);
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_payment_state ON public.external_bot_project_invoices(payment_state);
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_partner_name ON public.external_bot_project_invoices(partner_name);
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_agency_match ON public.external_bot_project_invoices(agency_match);
CREATE INDEX IF NOT EXISTS idx_external_bot_inv_amount_total ON public.external_bot_project_invoices(amount_total);

-- Enable RLS
ALTER TABLE public.external_bot_project_invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow read access to external bot invoices" ON public.external_bot_project_invoices
    FOR SELECT USING (true);

CREATE POLICY "Allow insert/update for service role" ON public.external_bot_project_invoices
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to sync from the external Supabase database using the REST API
CREATE OR REPLACE FUNCTION sync_external_bot_invoices_from_supabase()
RETURNS TABLE(
    synced_count INTEGER,
    sync_status TEXT,
    sync_timestamp TIMESTAMP WITH TIME ZONE,
    error_details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    record_count INTEGER := 0;
    sync_start_time TIMESTAMP WITH TIME ZONE;
    external_url TEXT := 'https://tnduapjjyqhppclgnqsb.supabase.co';
    api_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHVhcGpqeXFocHBjbGducXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTQ4ODcsImV4cCI6MjA2NDc5MDg4N30.4r-K4iFN0U3V9wZoWPLotFEvNVznVvxlAFLuFOvizDw';
BEGIN
    sync_start_time := NOW();
    
    -- Note: Direct HTTP requests from PostgreSQL require additional extensions
    -- This function serves as a placeholder for the actual sync logic
    -- The actual sync will be handled by Edge Functions or application code
    
    RAISE NOTICE 'External bot invoices sync function initialized for URL: %', external_url;
    RAISE NOTICE 'Sync should be handled by Edge Functions or application code';
    
    -- Return placeholder status
    RETURN QUERY SELECT 
        0,
        'FUNCTION_READY - Use Edge Functions or app code for actual sync'::TEXT,
        sync_start_time,
        'Direct HTTP sync from PostgreSQL requires additional setup'::TEXT;
        
END;
$$;

-- Create trigger to update updated_at timestamp
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

-- Create a view for easier access to key invoice data
CREATE OR REPLACE VIEW public.external_bot_invoices_summary AS
SELECT 
    id,
    invoice_number,
    customer_name,
    partner_name,
    date_order,
    amount_total,
    state,
    payment_state,
    currency_id,
    agency_match,
    created_at,
    updated_at
FROM public.external_bot_project_invoices
WHERE state IS NOT NULL
ORDER BY date_order DESC NULLS LAST, created_at DESC;

-- Create a view for analytics
CREATE OR REPLACE VIEW public.external_bot_invoices_analytics AS
SELECT 
    DATE_TRUNC('month', date_order) as month,
    agency_match,
    state,
    payment_state,
    COUNT(*) as invoice_count,
    SUM(amount_total) as total_amount,
    AVG(amount_total) as avg_amount,
    MIN(amount_total) as min_amount,
    MAX(amount_total) as max_amount
FROM public.external_bot_project_invoices
WHERE date_order IS NOT NULL AND amount_total IS NOT NULL
GROUP BY DATE_TRUNC('month', date_order), agency_match, state, payment_state
ORDER BY month DESC, total_amount DESC;

-- Grant permissions
GRANT ALL ON public.external_bot_project_invoices TO service_role;
GRANT SELECT ON public.external_bot_project_invoices TO authenticated;
GRANT SELECT ON public.external_bot_invoices_summary TO authenticated;
GRANT SELECT ON public.external_bot_invoices_analytics TO authenticated;

-- Grant sequence permissions (for BIGINT PRIMARY KEY)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Add table and column comments
COMMENT ON TABLE public.external_bot_project_invoices IS 'Invoices synced from external Supabase database at https://tnduapjjyqhppclgnqsb.supabase.co';
COMMENT ON COLUMN public.external_bot_project_invoices.id IS 'Primary key from external system';
COMMENT ON COLUMN public.external_bot_project_invoices.partner_name IS 'Customer/partner name from external system';
COMMENT ON COLUMN public.external_bot_project_invoices.date_order IS 'Order date from external system';
COMMENT ON COLUMN public.external_bot_project_invoices.amount_total IS 'Total invoice amount';
COMMENT ON COLUMN public.external_bot_project_invoices.state IS 'Invoice state (draft, posted, paid, cancel)';
COMMENT ON COLUMN public.external_bot_project_invoices.payment_state IS 'Payment state (not_paid, in_payment, paid, partial)';
COMMENT ON COLUMN public.external_bot_project_invoices.order_lines IS 'JSON array of order line items';
COMMENT ON COLUMN public.external_bot_project_invoices.agency_match IS 'Matched agency name for filtering';

COMMENT ON VIEW public.external_bot_invoices_summary IS 'Simplified view of external bot invoices with key fields';
COMMENT ON VIEW public.external_bot_invoices_analytics IS 'Analytics view for external bot invoices with aggregated data';

-- Insert sample data structure info for reference
INSERT INTO public.external_bot_project_invoices (
    id, invoice_number, customer_name, partner_name, date_order, 
    amount_total, state, payment_state, notes
) VALUES (
    -1, 'SAMPLE', 'Sample Customer', 'Sample Partner', NOW(), 
    0.00, 'sample', 'sample', 'This is a sample record for structure reference - will be replaced during sync'
) ON CONFLICT (id) DO NOTHING;