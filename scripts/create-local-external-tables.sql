-- Create local external tables in current database
-- Run this in Supabase SQL editor if you want to use current database

CREATE TABLE IF NOT EXISTS public.sales_targets (
    id TEXT NOT NULL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    target_year INTEGER,
    target_months TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT NOT NULL PRIMARY KEY,
    partner_name TEXT NOT NULL,
    date_order DATE,
    amount_total DECIMAL(15,2) DEFAULT 0,
    order_lines JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert sample data for NEXUS MARKETING
INSERT INTO public.sales_targets (id, customer_name, target_year, target_months) VALUES 
('target_1', 'NEXUS MARKETING', 2024, 'Q1'),
('target_2', 'NEXUS MARKETING', 2024, 'Q2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoices (id, partner_name, date_order, amount_total) VALUES 
('invoice_1', 'NEXUS MARKETING', '2024-01-15', 100000),
('invoice_2', 'NEXUS MARKETING', '2024-02-20', 150000)
ON CONFLICT (id) DO NOTHING;