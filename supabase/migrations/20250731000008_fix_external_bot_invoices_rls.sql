-- Fix RLS policies for external_bot_project_invoices table
-- Allow authenticated users to insert/update/delete external bot invoices

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow read access to external bot invoices" ON public.external_bot_project_invoices;
DROP POLICY IF EXISTS "Allow full access for service role" ON public.external_bot_project_invoices;

-- Create new permissive policies
CREATE POLICY "Allow authenticated users full access to external bot invoices" 
ON public.external_bot_project_invoices
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow service role full access to external bot invoices" 
ON public.external_bot_project_invoices
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow anon users read access to external bot invoices" 
ON public.external_bot_project_invoices
FOR SELECT 
TO anon 
USING (true);

-- Ensure the table still has RLS enabled
ALTER TABLE public.external_bot_project_invoices ENABLE ROW LEVEL SECURITY;