-- Create function to disable RLS for external bot invoices table
CREATE OR REPLACE FUNCTION disable_external_bot_invoices_rls()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Disable RLS on the table
    ALTER TABLE public.external_bot_project_invoices DISABLE ROW LEVEL SECURITY;
    
    RETURN 'RLS disabled for external_bot_project_invoices table';
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION disable_external_bot_invoices_rls() TO authenticated;
GRANT EXECUTE ON FUNCTION disable_external_bot_invoices_rls() TO anon;