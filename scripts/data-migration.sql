-- Data Migration Scripts for External Tables
-- Use these scripts to migrate data from your other Supabase project

-- =====================================================
-- OPTION 1: Direct INSERT with VALUES (if small dataset)
-- =====================================================

-- Example for external_sales_targets
-- Replace with your actual data
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
    ('target-1', 'Agency A', 2024, 'Q1', 2023, '{}', 100000.00, 120000.00, 20.00, 'admin'),
    ('target-2', 'Agency B', 2024, 'Q2', 2023, '{}', 150000.00, 180000.00, 20.00, 'admin');
-- Add more rows as needed

-- Example for external_invoices  
-- Replace with your actual data
INSERT INTO public.external_invoices (
    id,
    name,
    partner_name,
    date_order,
    amount_total,
    state,
    order_lines
) VALUES
    ('inv-1', 'INV/2024/0001', 'Agency A', '2024-01-15', 25000.00, 'posted', '[]'),
    ('inv-2', 'INV/2024/0002', 'Agency B', '2024-02-20', 35000.00, 'posted', '[]');
-- Add more rows as needed

-- =====================================================
-- OPTION 2: Import from CSV (Recommended for large datasets)
-- =====================================================

-- Steps to use CSV import:
-- 1. Export your data from other project as CSV
-- 2. Use Supabase Dashboard > Table > Import CSV
-- 3. Or use psql COPY command (example below)

/*
-- Example COPY commands (run these in psql or Supabase SQL Editor)
-- Make sure CSV files are accessible to your Supabase instance

COPY public.external_sales_targets (
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
) 
FROM '/path/to/sales_targets.csv' 
DELIMITER ',' 
CSV HEADER;

COPY public.external_invoices (
    id,
    name,
    partner_name,
    date_order,
    amount_total,
    state,
    order_lines
)
FROM '/path/to/invoices.csv'
DELIMITER ','
CSV HEADER;
*/

-- =====================================================
-- OPTION 3: Cross-database migration using dblink
-- =====================================================

-- This requires dblink extension and connection to your other Supabase instance
-- Note: This may not work with Supabase due to security restrictions

/*
-- Enable dblink extension (may require superuser)
CREATE EXTENSION IF NOT EXISTS dblink;

-- Create connection to other Supabase project
SELECT dblink_connect('other_db', 'host=db.your-other-project.supabase.co port=5432 dbname=postgres user=postgres password=your-password sslmode=require');

-- Migrate sales_targets
INSERT INTO public.external_sales_targets (
    id, customer_name, target_year, target_months, base_year, 
    target_data, initial_total_value, adjusted_total_value, 
    percentage_increase, created_by
)
SELECT 
    id, customer_name, target_year, target_months, base_year,
    target_data, initial_total_value, adjusted_total_value,
    percentage_increase, created_by
FROM dblink('other_db', 'SELECT id, customer_name, target_year, target_months, base_year, target_data, initial_total_value, adjusted_total_value, percentage_increase, created_by FROM sales_targets') 
AS t(id text, customer_name text, target_year integer, target_months text, base_year integer, target_data jsonb, initial_total_value decimal, adjusted_total_value decimal, percentage_increase decimal, created_by text);

-- Migrate invoices
INSERT INTO public.external_invoices (
    id, name, partner_name, date_order, amount_total, state, order_lines
)
SELECT 
    id, name, partner_name, date_order, amount_total, state, order_lines
FROM dblink('other_db', 'SELECT id, name, partner_name, date_order, amount_total, state, order_lines FROM invoices') 
AS t(id text, name text, partner_name text, date_order date, amount_total decimal, state text, order_lines jsonb);

-- Close connection
SELECT dblink_disconnect('other_db');
*/

-- =====================================================
-- Data Validation Queries
-- =====================================================

-- Check migrated data counts
SELECT 'external_sales_targets' as table_name, COUNT(*) as record_count FROM public.external_sales_targets
UNION ALL
SELECT 'external_invoices' as table_name, COUNT(*) as record_count FROM public.external_invoices;

-- Check unique agency names in external data
SELECT DISTINCT customer_name FROM public.external_sales_targets ORDER BY customer_name;
SELECT DISTINCT partner_name FROM public.external_invoices ORDER BY partner_name;

-- Verify agency name matching
SELECT 
    a.name as agency_name,
    COUNT(DISTINCT st.id) as targets_count,
    COUNT(DISTINCT inv.id) as invoices_count
FROM public.agencies a
LEFT JOIN public.external_sales_targets st ON a.name = st.customer_name
LEFT JOIN public.external_invoices inv ON a.name = inv.partner_name
GROUP BY a.name
ORDER BY a.name;

-- Check for orphaned external data (agency names that don't match)
SELECT 'Missing in agencies' as issue, customer_name as name, COUNT(*) as count
FROM public.external_sales_targets st
WHERE NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.name = st.customer_name)
GROUP BY customer_name
UNION ALL
SELECT 'Missing in agencies' as issue, partner_name as name, COUNT(*) as count
FROM public.external_invoices inv
WHERE NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.name = inv.partner_name)
GROUP BY partner_name;