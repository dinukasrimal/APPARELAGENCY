-- Final migration to create external_bot_project_invoices table 
-- Using actual external Supabase credentials: tnduapjjyqhppclgnqsb.supabase.co

-- Create the external_bot_project_invoices table
CREATE TABLE IF NOT EXISTS public.external_bot_project_invoices (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255), -- Invoice number/name from external system
    partner_name VARCHAR(255), -- Customer name
    date_order TIMESTAMP WITH TIME ZONE,
    amount_total DECIMAL(15,2),
    state VARCHAR(100), -- draft, posted, paid, cancel
    order_lines JSONB, -- JSON array of order line items
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Additional fields that might exist in external invoices table
    company_id BIGINT,
    user_id BIGINT,
    team_id BIGINT,
    currency_id VARCHAR(10),
    payment_state VARCHAR(50),
    date_invoice TIMESTAMP WITH TIME ZONE,
    invoice_origin VARCHAR(255),
    reference VARCHAR(255),
    move_type VARCHAR(50),
    journal_id BIGINT,
    fiscal_position_id BIGINT,
    invoice_payment_term_id BIGINT,
    auto_post BOOLEAN DEFAULT FALSE,
    to_check BOOLEAN DEFAULT FALSE,
    -- Metadata
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    agency_match VARCHAR(255), -- For matching with local agencies
    original_external_id VARCHAR(255) -- Store original external ID (may be string)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_partner_name ON public.external_bot_project_invoices(partner_name);
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_date_order ON public.external_bot_project_invoices(date_order);
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_state ON public.external_bot_project_invoices(state);
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_amount_total ON public.external_bot_project_invoices(amount_total);
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_company_id ON public.external_bot_project_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_sync_timestamp ON public.external_bot_project_invoices(sync_timestamp);
CREATE INDEX IF NOT EXISTS idx_ext_bot_inv_original_external_id ON public.external_bot_project_invoices(original_external_id);

-- Enable RLS
ALTER TABLE public.external_bot_project_invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow read access to external bot invoices" ON public.external_bot_project_invoices
    FOR SELECT USING (true);

CREATE POLICY "Allow full access for service role" ON public.external_bot_project_invoices
    FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_external_bot_invoices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_external_bot_invoices_timestamp_trigger
    BEFORE UPDATE ON public.external_bot_project_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_external_bot_invoices_timestamp();

-- Create useful views
CREATE OR REPLACE VIEW public.external_bot_invoices_summary AS
SELECT 
    id,
    name as invoice_number,
    partner_name as customer_name,
    date_order,
    amount_total,
    state,
    payment_state,
    currency_id,
    agency_match,
    sync_timestamp
FROM public.external_bot_project_invoices
ORDER BY date_order DESC NULLS LAST;

-- Create analytics view
CREATE OR REPLACE VIEW public.external_bot_invoices_monthly AS
SELECT 
    DATE_TRUNC('month', date_order) as month,
    state,
    COUNT(*) as invoice_count,
    SUM(amount_total) as total_amount,
    AVG(amount_total) as avg_amount
FROM public.external_bot_project_invoices
WHERE date_order IS NOT NULL
GROUP BY DATE_TRUNC('month', date_order), state
ORDER BY month DESC;

-- Grant permissions
GRANT ALL ON public.external_bot_project_invoices TO service_role;
GRANT SELECT ON public.external_bot_project_invoices TO authenticated;
GRANT SELECT ON public.external_bot_invoices_summary TO authenticated;
GRANT SELECT ON public.external_bot_invoices_monthly TO authenticated;

-- Add comments
COMMENT ON TABLE public.external_bot_project_invoices IS 'Invoices synced from external Supabase project: tnduapjjyqhppclgnqsb';
COMMENT ON COLUMN public.external_bot_project_invoices.name IS 'Invoice number/identifier from external system';
COMMENT ON COLUMN public.external_bot_project_invoices.partner_name IS 'Customer/partner name';
COMMENT ON COLUMN public.external_bot_project_invoices.amount_total IS 'Total invoice amount';
COMMENT ON COLUMN public.external_bot_project_invoices.state IS 'Invoice state: draft, posted, paid, cancel';
COMMENT ON COLUMN public.external_bot_project_invoices.order_lines IS 'JSON array containing invoice line items';

-- Create function to manually trigger sync (to be called by Edge Function)
CREATE OR REPLACE FUNCTION trigger_external_bot_sync()
RETURNS TABLE(
    status TEXT,
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function serves as a trigger point for external sync
    -- The actual sync logic is handled by the Edge Function
    
    RETURN QUERY SELECT 
        'READY'::TEXT,
        'Use Edge Function /sync-external-bot-invoices to perform actual sync'::TEXT,
        NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_external_bot_sync() TO authenticated;