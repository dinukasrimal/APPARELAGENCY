-- Fix External Bot Sync Cron Configuration
-- This migration fixes the cron function to work properly with environment settings

-- First, drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS trigger_external_bot_sync();

CREATE OR REPLACE FUNCTION trigger_external_bot_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sync_result jsonb;
    response_status int;
    response_content text;
    supabase_url text;
    service_key text;
    request_url text;
BEGIN
    -- Get Supabase URL and service key from app settings or use defaults
    BEGIN
        supabase_url := current_setting('app.supabase_url', true);
        IF supabase_url IS NULL OR supabase_url = '' THEN
            -- Fallback to common local development URL
            supabase_url := 'http://localhost:54321';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        supabase_url := 'http://localhost:54321';
    END;
    
    BEGIN
        service_key := current_setting('app.supabase_service_role_key', true);
        IF service_key IS NULL OR service_key = '' THEN
            -- Log warning about missing service key
            RAISE NOTICE 'Warning: No service role key configured. Using anon key fallback.';
            -- You should set the service role key in your environment
            service_key := current_setting('app.supabase_anon_key', true);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to a basic key (this should be configured properly in production)
        service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE5NTczNDUyMDB9.zqVHLwJigrGiHSMRBRbGjqTu_sFxJKpSJnfRXZqBOgY';
    END;
    
    request_url := supabase_url || '/functions/v1/sync-external-bot-invoices';
    
    RAISE NOTICE 'Attempting automatic sync to: %', request_url;
    
    -- Call the sync edge function directly
    SELECT 
        (response).status,
        (response).content
    INTO 
        response_status,
        response_content
    FROM extensions.http((
        'POST',
        request_url,
        ARRAY[
            extensions.http_header('Authorization', 'Bearer ' || service_key),
            extensions.http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{}'
    )::http_request);
    
    -- Parse JSON response
    BEGIN
        sync_result := response_content::jsonb;
    EXCEPTION WHEN OTHERS THEN
        sync_result := jsonb_build_object(
            'success', false, 
            'message', 'Invalid JSON response: ' || COALESCE(response_content, 'null')
        );
    END;
    
    -- Check if the HTTP call was successful
    IF response_status = 200 AND COALESCE((sync_result->>'success')::boolean, false) = true THEN
        -- Log the successful automatic sync
        INSERT INTO public.external_bot_sync_log (
            sync_timestamp, 
            status, 
            synced_count, 
            message,
            details
        ) VALUES (
            NOW(), 
            'success', 
            COALESCE((sync_result->>'synced_count')::int, 0), 
            'Automatic external bot sync completed successfully',
            jsonb_build_object(
                'sync_result', sync_result,
                'http_status', response_status,
                'request_url', request_url
            )
        );
        
        RAISE NOTICE 'Automatic external bot sync completed successfully at %. Synced count: %', 
            NOW(), COALESCE((sync_result->>'synced_count')::int, 0);
    ELSE
        -- Log HTTP or sync failure
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
            'Automatic sync failed - HTTP status: ' || response_status || ', Response: ' || COALESCE(sync_result->>'message', 'No response'),
            jsonb_build_object(
                'http_status', response_status,
                'response', sync_result,
                'response_content', response_content,
                'request_url', request_url,
                'supabase_url', supabase_url
            )
        );
        
        RAISE NOTICE 'Automatic sync failed - HTTP status: %, Response: %', response_status, response_content;
    END IF;
    
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
        'Automatic sync failed: ' || SQLERRM,
        jsonb_build_object(
            'error', SQLERRM,
            'error_state', SQLSTATE,
            'error_context', 'cron_function_execution',
            'supabase_url', COALESCE(supabase_url, 'not_set'),
            'service_key_configured', CASE WHEN service_key IS NOT NULL AND service_key != '' THEN true ELSE false END
        )
    );
    
    RAISE NOTICE 'Automatic sync error: % (State: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_external_bot_sync() TO postgres;

-- Create a function to set the required configuration
CREATE OR REPLACE FUNCTION setup_sync_config(
    p_supabase_url text DEFAULT 'http://localhost:54321',
    p_service_key text DEFAULT NULL,
    p_anon_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set the configuration
    PERFORM set_config('app.supabase_url', p_supabase_url, false);
    
    IF p_service_key IS NOT NULL THEN
        PERFORM set_config('app.supabase_service_role_key', p_service_key, false);
    END IF;
    
    IF p_anon_key IS NOT NULL THEN
        PERFORM set_config('app.supabase_anon_key', p_anon_key, false);
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Sync configuration updated',
        'config', jsonb_build_object(
            'supabase_url', current_setting('app.supabase_url', true),
            'service_key_set', CASE WHEN current_setting('app.supabase_service_role_key', true) IS NOT NULL THEN true ELSE false END,
            'anon_key_set', CASE WHEN current_setting('app.supabase_anon_key', true) IS NOT NULL THEN true ELSE false END
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION setup_sync_config(text, text, text) TO authenticated;

-- Add a function to test the sync configuration
CREATE OR REPLACE FUNCTION test_sync_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_info jsonb;
BEGIN
    config_info := jsonb_build_object(
        'supabase_url', COALESCE(current_setting('app.supabase_url', true), 'not_set'),
        'service_key_configured', CASE 
            WHEN current_setting('app.supabase_service_role_key', true) IS NOT NULL AND 
                 current_setting('app.supabase_service_role_key', true) != '' 
            THEN true 
            ELSE false 
        END,
        'anon_key_configured', CASE 
            WHEN current_setting('app.supabase_anon_key', true) IS NOT NULL AND 
                 current_setting('app.supabase_anon_key', true) != '' 
            THEN true 
            ELSE false 
        END,
        'http_extension_available', CASE 
            WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') 
            THEN true 
            ELSE false 
        END
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Sync configuration status',
        'config', config_info,
        'recommendations', CASE 
            WHEN NOT (config_info->>'service_key_configured')::boolean THEN 
                jsonb_build_array('Set service role key using setup_sync_config() function')
            ELSE 
                jsonb_build_array('Configuration looks good')
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION test_sync_config() TO authenticated;

-- Ensure cron jobs are properly scheduled (reschedule to be safe)
SELECT cron.unschedule('external-bot-sync-morning') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'external-bot-sync-morning'
);

SELECT cron.unschedule('external-bot-sync-evening') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'external-bot-sync-evening'
);

-- Schedule the cron jobs
SELECT cron.schedule(
    'external-bot-sync-morning',
    '0 6 * * *',  -- 6:00 AM UTC daily
    'SELECT trigger_external_bot_sync();'
);

SELECT cron.schedule(
    'external-bot-sync-evening', 
    '0 18 * * *', -- 6:00 PM UTC daily
    'SELECT trigger_external_bot_sync();'
);

-- Show current configuration status
SELECT test_sync_config();

-- Show current cron jobs
SELECT 
    jobname,
    schedule,
    command,
    active,
    nodename
FROM cron.job 
WHERE jobname LIKE 'external-bot-sync%'
ORDER BY jobname;

-- Instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== EXTERNAL BOT SYNC CONFIGURATION UPDATED ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Configure your environment by running:';
    RAISE NOTICE '   SELECT setup_sync_config(''YOUR_SUPABASE_URL'', ''YOUR_SERVICE_KEY'', ''YOUR_ANON_KEY'');';
    RAISE NOTICE '';
    RAISE NOTICE '2. Test configuration:';
    RAISE NOTICE '   SELECT test_sync_config();';
    RAISE NOTICE '';
    RAISE NOTICE '3. Test manual sync:';
    RAISE NOTICE '   SELECT test_automatic_external_bot_sync();';
    RAISE NOTICE '';
    RAISE NOTICE '4. Monitor sync logs:';
    RAISE NOTICE '   SELECT * FROM external_bot_sync_log ORDER BY sync_timestamp DESC LIMIT 5;';
    RAISE NOTICE '';
END;
$$;
