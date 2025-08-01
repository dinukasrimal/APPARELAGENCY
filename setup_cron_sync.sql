-- Setup pg_cron for automatic external bot invoice sync
-- Run this directly in Supabase SQL Editor

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the sync Edge Function
CREATE OR REPLACE FUNCTION trigger_external_bot_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url text := 'https://ejpwmgluazqcczrpwjlo.supabase.co';
    request_id bigint;
    service_key text;
BEGIN
    -- Get the service key from your environment
    -- You need to set this as a custom setting in your Supabase project
    service_key := current_setting('app.supabase_service_key', true);
    
    -- If no service key is set, use a placeholder (you'll need to update this)
    IF service_key IS NULL OR service_key = '' THEN
        service_key := 'YOUR_SERVICE_ROLE_KEY_HERE';
    END IF;
    
    -- Log sync attempt
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message
    ) VALUES (
        NOW(), 
        'cron_initiated', 
        0, 
        'pg_cron initiated external bot sync'
    );
    
    -- Make HTTP request to sync Edge Function
    SELECT net.http_post(
        url := supabase_url || '/functions/v1/cron-sync-trigger',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
            'source', 'pg_cron',
            'timestamp', extract(epoch from now())
        )::text
    ) INTO request_id;
    
    -- Update log with request details
    UPDATE public.external_bot_sync_log 
    SET 
        message = 'HTTP request sent to Edge Function, ID: ' || COALESCE(request_id::text, 'unknown'),
        details = jsonb_build_object('request_id', request_id, 'url', supabase_url || '/functions/v1/cron-sync-trigger')
    WHERE sync_timestamp = (
        SELECT MAX(sync_timestamp) 
        FROM public.external_bot_sync_log 
        WHERE status = 'cron_initiated'
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message, 
        details
    ) VALUES (
        NOW(), 
        'cron_error', 
        0, 
        'pg_cron sync failed: ' || SQLERRM,
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
    );
END;
$$;

-- Remove any existing cron jobs to avoid duplicates
DO $$
BEGIN
    -- Unschedule morning job if it exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'external-bot-sync-morning') THEN
        PERFORM cron.unschedule('external-bot-sync-morning');
    END IF;
    
    -- Unschedule evening job if it exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'external-bot-sync-evening') THEN
        PERFORM cron.unschedule('external-bot-sync-evening');
    END IF;
END
$$;

-- Schedule the cron jobs
-- 6:00 AM UTC daily
SELECT cron.schedule(
    'external-bot-sync-morning',
    '0 6 * * *',
    'SELECT trigger_external_bot_sync();'
);

-- 6:00 PM UTC daily  
SELECT cron.schedule(
    'external-bot-sync-evening', 
    '0 18 * * *',
    'SELECT trigger_external_bot_sync();'
);

-- Create a test function for manual triggering
CREATE OR REPLACE FUNCTION test_cron_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM trigger_external_bot_sync();
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Manual cron sync test triggered successfully',
        'timestamp', NOW()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'timestamp', NOW()
    );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION trigger_external_bot_sync() TO postgres;
GRANT EXECUTE ON FUNCTION test_cron_sync() TO authenticated;

-- Create view for monitoring cron job history
CREATE OR REPLACE VIEW external_bot_cron_history AS
SELECT 
    j.jobname,
    j.schedule,
    j.active,
    r.start_time,
    r.end_time,
    r.return_message,
    CASE 
        WHEN r.return_message IS NULL THEN 'pending'
        WHEN r.return_message LIKE '%error%' OR r.return_message LIKE '%failed%' THEN 'failed'
        ELSE 'success'
    END as status
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname LIKE 'external-bot-sync%'
ORDER BY r.start_time DESC NULLS LAST
LIMIT 50;

GRANT SELECT ON external_bot_cron_history TO authenticated;

-- Show current cron jobs
SELECT 
    jobname,
    schedule,
    active,
    command
FROM cron.job 
WHERE jobname LIKE 'external-bot-sync%';

-- Test the setup (optional - uncomment to test immediately)
-- SELECT test_cron_sync();