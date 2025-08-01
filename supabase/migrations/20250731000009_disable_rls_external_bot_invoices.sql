-- Temporarily disable RLS for external_bot_project_invoices table
-- This allows the sync operations to work without authentication issues

ALTER TABLE public.external_bot_project_invoices DISABLE ROW LEVEL SECURITY;

-- Add a comment explaining why RLS is disabled
COMMENT ON TABLE public.external_bot_project_invoices IS 'RLS disabled to allow sync operations from external systems. Table contains read-only sync data from external Supabase project.';