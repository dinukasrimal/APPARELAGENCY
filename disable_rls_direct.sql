-- Direct SQL commands to paste into Supabase SQL Editor
-- This will forcefully disable RLS on the external_bot_project_invoices table

-- 1. Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users full access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow service role full access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow anon users read access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow read access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow full access for service role" ON public.external_bot_project_invoices;

-- 2. Disable RLS completely
ALTER TABLE public.external_bot_project_invoices DISABLE ROW LEVEL SECURITY;

-- 3. Verify RLS is disabled (should return false)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'external_bot_project_invoices';

-- 4. Grant necessary permissions
GRANT ALL ON public.external_bot_project_invoices TO authenticated;
GRANT ALL ON public.external_bot_project_invoices TO anon;

-- 5. Test insert (should work now)
INSERT INTO public.external_bot_project_invoices (
    id, name, partner_name, amount_total, state, sync_timestamp, agency_match
) VALUES (
    999999, 'TEST_RECORD', 'TEST_CUSTOMER', 0, 'test', NOW(), null
);

-- 6. Clean up test record
DELETE FROM public.external_bot_project_invoices WHERE id = 999999;