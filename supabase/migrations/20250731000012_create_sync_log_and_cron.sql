-- Create sync log table to track automatic syncs
CREATE TABLE IF NOT EXISTS public.external_bot_sync_log (
    id BIGSERIAL PRIMARY KEY,
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL, -- success, error, warning
    synced_count INTEGER DEFAULT 0,
    message TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for the log table
CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON public.external_bot_sync_log(sync_timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON public.external_bot_sync_log(status);

-- Enable RLS for the log table
ALTER TABLE public.external_bot_sync_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the log table
CREATE POLICY "Allow service role full access to sync log" 
ON public.external_bot_sync_log
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users read access to sync log" 
ON public.external_bot_sync_log
FOR SELECT 
TO authenticated 
USING (true);

-- Grant permissions
GRANT ALL ON public.external_bot_sync_log TO service_role;
GRANT SELECT ON public.external_bot_sync_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.external_bot_sync_log_id_seq TO service_role;

-- Create function to get latest sync status
CREATE OR REPLACE FUNCTION get_latest_external_bot_sync_status()
RETURNS TABLE(
    last_sync_time TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50),
    last_sync_count INTEGER,
    last_sync_message TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        sync_timestamp,
        status,
        synced_count,
        message
    FROM public.external_bot_sync_log 
    ORDER BY sync_timestamp DESC 
    LIMIT 1;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_latest_external_bot_sync_status() TO authenticated;

-- Add comment
COMMENT ON TABLE public.external_bot_sync_log IS 'Log table for tracking external bot invoice sync operations';
COMMENT ON FUNCTION get_latest_external_bot_sync_status() IS 'Returns the status of the most recent external bot sync operation';