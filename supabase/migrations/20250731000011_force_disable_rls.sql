-- Force disable RLS on external_bot_project_invoices table
-- This should override any existing RLS policies

-- First drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users full access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow service role full access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow anon users read access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow read access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow full access for service role" ON public.external_bot_project_invoices;

-- Disable RLS completely
ALTER TABLE public.external_bot_project_invoices DISABLE ROW LEVEL SECURITY;

-- Create a function to verify RLS status
CREATE OR REPLACE FUNCTION check_external_bot_rls_status()
RETURNS TABLE(
    table_name TEXT,
    rls_enabled BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        schemaname||'.'||tablename as table_name,
        rowsecurity as rls_enabled
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'external_bot_project_invoices';
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_external_bot_rls_status() TO authenticated;
GRANT EXECUTE ON FUNCTION check_external_bot_rls_status() TO anon;