-- Test script to check external bot project invoices setup
-- Run this to diagnose the issue

-- 1. Check if the table exists
SELECT 
    table_name, 
    table_schema,
    table_type
FROM information_schema.tables 
WHERE table_name = 'external_bot_project_invoices';

-- 2. Check table structure if it exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'external_bot_project_invoices'
ORDER BY ordinal_position;

-- 3. Check if table has any data
SELECT COUNT(*) as record_count FROM public.external_bot_project_invoices;

-- 4. Check the last few migration files that were applied
SELECT 
    version,
    name,
    executed_at
FROM supabase_migrations.schema_migrations 
WHERE name LIKE '%external_bot%' OR name LIKE '%external%'
ORDER BY executed_at DESC;

-- 5. Try to check if external sync function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name LIKE '%external_bot%' OR routine_name LIKE '%sync_external%';

-- 6. Check if any Edge Functions related to external sync exist
-- (This would need to be checked via Supabase dashboard or CLI)

-- 7. Test basic functionality - try to insert a test record
INSERT INTO public.external_bot_project_invoices (
    id, name, partner_name, amount_total, state, sync_timestamp
) VALUES (
    -999, 'TEST-001', 'Test Customer', 100.00, 'test', NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- 8. Check if the test record was inserted
SELECT * FROM public.external_bot_project_invoices WHERE id = -999;