-- Simple cron setup using pg_net for HTTP requests
-- This requires the pg_net extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a simple function to trigger sync via HTTP
CREATE OR REPLACE FUNCTION trigger_sync_via_webhook()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url text := 'https://ejpwmgluazqcczrpwjlo.supabase.co';
    service_key text;
    request_id bigint;
BEGIN
    -- Get service key from vault (you'll need to store this in Supabase Vault)
    -- For now, we'll use a placeholder approach
    
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
        'Cron job initiated sync via webhook'
    );
    
    -- Make HTTP request to trigger sync
    -- Note: You'll need to configure the service key in your Supabase project
    SELECT net.http_post(
        url := supabase_url || '/functions/v1/cron-sync-trigger',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(
                current_setting('app.supabase_service_key', true), 
                'your-service-key-here'
            )
        ),
        body := jsonb_build_object(
            'source', 'cron',
            'timestamp', extract(epoch from now())
        )
    ) INTO request_id;
    
    -- Log the request
    UPDATE public.external_bot_sync_log 
    SET 
        message = 'HTTP request sent, ID: ' || request_id,
        details = jsonb_build_object('request_id', request_id)
    WHERE sync_timestamp = (SELECT MAX(sync_timestamp) FROM public.external_bot_sync_log WHERE status = 'cron_initiated');
    
EXCEPTION WHEN OTHERS THEN
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
        'Cron webhook trigger failed: ' || SQLERRM,
        jsonb_build_object('error', SQLERRM)
    );
END;
$$;

-- Remove any existing cron jobs with the same names
SELECT cron.unschedule('external-bot-sync-morning');
SELECT cron.unschedule('external-bot-sync-evening');

-- Schedule the cron jobs
SELECT cron.schedule(
    'external-bot-sync-morning',
    '0 6 * * *',  -- 6:00 AM daily
    'SELECT trigger_sync_via_webhook();'
);

SELECT cron.schedule(
    'external-bot-sync-evening', 
    '0 18 * * *', -- 6:00 PM daily
    'SELECT trigger_sync_via_webhook();'
);

-- Create a function to manually test the cron trigger
CREATE OR REPLACE FUNCTION test_cron_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM trigger_sync_via_webhook();
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Cron sync test triggered',
        'timestamp', NOW()
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_sync_via_webhook() TO postgres;
GRANT EXECUTE ON FUNCTION test_cron_sync() TO authenticated;

-- Check cron jobs
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM cron.job 
WHERE jobname LIKE 'external-bot-sync%';

-- Create a view to monitor cron job history
CREATE OR REPLACE VIEW external_bot_cron_history AS
SELECT 
    j.jobname,
    j.schedule,
    j.active,
    r.start_time,
    r.end_time,
    r.return_message,
    r.status
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname LIKE 'external-bot-sync%'
ORDER BY r.start_time DESC
LIMIT 50;

GRANT SELECT ON external_bot_cron_history TO authenticated;