-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Edge Function via HTTP
CREATE OR REPLACE FUNCTION trigger_external_bot_sync_http()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    response_body text;
    response_status integer;
    supabase_url text;
    service_key text;
BEGIN
    -- Get Supabase URL and service key from app settings or environment
    -- You'll need to set these values in your Supabase dashboard
    supabase_url := current_setting('app.supabase_url', true);
    service_key := current_setting('app.supabase_service_key', true);
    
    -- If settings are not configured, use hardcoded values (not recommended for production)
    IF supabase_url IS NULL THEN
        supabase_url := 'https://ejpwmgluazqcczrpwjlo.supabase.co';
    END IF;
    
    -- Log the sync attempt
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message
    ) VALUES (
        NOW(), 
        'started', 
        0, 
        'Cron job initiated sync'
    );
    
    -- Note: HTTP requests from pg_cron require additional setup
    -- For now, we'll create a simpler approach using a direct sync function
    RAISE NOTICE 'Sync trigger executed at %', NOW();
    
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
        'error', 
        0, 
        'Cron sync failed: ' || SQLERRM,
        jsonb_build_object('error', SQLERRM)
    );
END;
$$;

-- Create a simpler function that uses the existing sync service logic
CREATE OR REPLACE FUNCTION external_bot_cron_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sync_result jsonb;
    sync_count integer := 0;
    sync_message text;
BEGIN
    -- Log sync start
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message
    ) VALUES (
        NOW(), 
        'started', 
        0, 
        'Automated cron sync started'
    );
    
    -- Call the Edge Function URL using pg_net if available, otherwise log for manual check
    -- Since HTTP calls from cron can be complex, we'll trigger via a webhook approach
    
    -- For now, create a notification that sync should be triggered
    PERFORM pg_notify('external_bot_sync_trigger', json_build_object(
        'timestamp', extract(epoch from now()),
        'source', 'cron',
        'message', 'Automated sync triggered'
    )::text);
    
    -- Log that trigger was sent
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message
    ) VALUES (
        NOW(), 
        'triggered', 
        0, 
        'Sync trigger notification sent via pg_notify'
    );
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message, 
        details
    ) VALUES (
        NOW(), 
        'error', 
        0, 
        'Cron function failed: ' || SQLERRM,
        jsonb_build_object('error', SQLERRM)
    );
END;
$$;

-- Schedule the cron job to run twice daily (6 AM and 6 PM)
SELECT cron.schedule(
    'external-bot-sync-morning',
    '0 6 * * *',  -- 6:00 AM daily
    'SELECT external_bot_cron_sync();'
);

SELECT cron.schedule(
    'external-bot-sync-evening', 
    '0 18 * * *', -- 6:00 PM daily
    'SELECT external_bot_cron_sync();'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION trigger_external_bot_sync_http() TO postgres;
GRANT EXECUTE ON FUNCTION external_bot_cron_sync() TO postgres;

-- Add comments
COMMENT ON FUNCTION external_bot_cron_sync() IS 'Automated cron function to trigger external bot invoice sync twice daily';
COMMENT ON FUNCTION trigger_external_bot_sync_http() IS 'HTTP-based sync trigger function (requires additional setup)';

-- Check if cron jobs were created successfully
SELECT * FROM cron.job WHERE jobname LIKE 'external-bot-sync%';