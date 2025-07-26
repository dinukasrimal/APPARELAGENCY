-- Create external tables manually
-- Run this if migrations aren't working

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.external_invoices CASCADE;
DROP TABLE IF EXISTS public.external_sales_targets CASCADE;

-- Create external_invoices table
CREATE TABLE public.external_invoices (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    partner_name TEXT NOT NULL,
    date_order DATE NOT NULL,
    amount_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    state TEXT,
    order_lines JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CHECK (amount_total >= 0)
);

-- Create external_sales_targets table
CREATE TABLE public.external_sales_targets (
    id TEXT NOT NULL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    target_year INTEGER NOT NULL,
    target_months TEXT,
    base_year INTEGER,
    target_data JSONB,
    initial_total_value DECIMAL(15,2) DEFAULT 0,
    adjusted_total_value DECIMAL(15,2) DEFAULT 0,
    percentage_increase DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by TEXT,
    
    CHECK (initial_total_value >= 0),
    CHECK (adjusted_total_value >= 0),
    CHECK (percentage_increase >= -100)
);

-- Create indexes
CREATE INDEX idx_external_invoices_partner_name ON public.external_invoices(partner_name);
CREATE INDEX idx_external_invoices_date_order ON public.external_invoices(date_order DESC);
CREATE INDEX idx_external_invoices_state ON public.external_invoices(state);
CREATE INDEX idx_external_invoices_amount ON public.external_invoices(amount_total DESC);

CREATE INDEX idx_external_sales_targets_customer_name ON public.external_sales_targets(customer_name);
CREATE INDEX idx_external_sales_targets_year ON public.external_sales_targets(target_year);
CREATE INDEX idx_external_sales_targets_months ON public.external_sales_targets(target_months);
CREATE INDEX idx_external_sales_targets_values ON public.external_sales_targets(adjusted_total_value DESC);

-- Enable RLS
ALTER TABLE public.external_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_sales_targets ENABLE ROW LEVEL SECURITY;

-- Insert sample data for NEXUS MARKETING
INSERT INTO public.external_sales_targets (
    id,
    customer_name,
    target_year,
    target_months,
    base_year,
    target_data,
    initial_total_value,
    adjusted_total_value,
    percentage_increase,
    created_by
) VALUES 
(
    'ext_target_nexus_2024_q1',
    'NEXUS MARKETING',
    2024,
    'Q1',
    2023,
    '{"categories": [
        {"category": "Apparel", "target": 500000, "percentage": 50},
        {"category": "Accessories", "target": 300000, "percentage": 30},
        {"category": "Footwear", "target": 200000, "percentage": 20}
    ]}'::jsonb,
    800000,
    1000000,
    25.0,
    'system'
),
(
    'ext_target_nexus_2024_q2',
    'NEXUS MARKETING',
    2024,
    'Q2',
    2023,
    '{"categories": [
        {"category": "Apparel", "target": 600000, "percentage": 50},
        {"category": "Accessories", "target": 360000, "percentage": 30},
        {"category": "Footwear", "target": 240000, "percentage": 20}
    ]}'::jsonb,
    960000,
    1200000,
    25.0,
    'system'
);

INSERT INTO public.external_invoices (
    id,
    name,
    partner_name,
    date_order,
    amount_total,
    state,
    order_lines
) VALUES 
(
    'ext_invoice_nexus_001',
    'INV/2024/0001',
    'NEXUS MARKETING',
    '2024-01-15',
    150000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Cotton T-Shirts", "price_total": 75000},
        {"product_category": "Accessories", "product_name": "Baseball Caps", "price_total": 45000},
        {"product_category": "Footwear", "product_name": "Canvas Sneakers", "price_total": 30000}
    ]'::jsonb
),
(
    'ext_invoice_nexus_002',
    'INV/2024/0025',
    'NEXUS MARKETING',
    '2024-02-20',
    225000,
    'posted',
    '[
        {"product_category": "Apparel", "product_name": "Polo Shirts", "price_total": 120000},
        {"product_category": "Accessories", "product_name": "Wristbands", "price_total": 65000},
        {"product_category": "Footwear", "product_name": "Sports Shoes", "price_total": 40000}
    ]'::jsonb
);