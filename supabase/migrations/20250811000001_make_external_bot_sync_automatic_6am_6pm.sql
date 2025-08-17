-- Make External Bot Sync Fully Automatic + Change Schedule to 6 AM/PM UTC
-- This migration updates the cron function to actually perform sync instead of just logging requests
-- and changes the schedule from 11:30 AM/PM to 6:00 AM/PM UTC

-- First, unschedule existing cron jobs (currently running at 11:30)
SELECT cron.unschedule('external-bot-sync-morning');
SELECT cron.unschedule('external-bot-sync-evening');

-- Enable http extension for making HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS http;

-- Update the cron function to actually perform sync instead of just logging
CREATE OR REPLACE FUNCTION trigger_external_bot_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sync_result jsonb;
    response_status int;
    response_content text;
BEGIN
    -- Call the sync edge function directly
    SELECT 
        (response).status,
        (response).content
    INTO 
        response_status,
        response_content
    FROM extensions.http((
        'POST',
        current_setting('app.supabase_url') || '/functions/v1/sync-external-bot-invoices',
        ARRAY[
            extensions.http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')),
            extensions.http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{}'
    )::extensions.http_request);
    
    -- Parse JSON response
    BEGIN
        sync_result := response_content::jsonb;
    EXCEPTION WHEN OTHERS THEN
        sync_result := jsonb_build_object('success', false, 'message', 'Invalid JSON response');
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
            sync_result
        );
        
        RAISE NOTICE 'Automatic external bot sync completed successfully at %', NOW();
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
                'response_content', response_content
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
            'error_context', 'cron_function_execution'
        )
    );
    
    RAISE NOTICE 'Automatic sync error: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_external_bot_sync() TO postgres;

-- Schedule the new automatic cron jobs at 6 AM and 6 PM UTC
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

-- Test function for the new automatic sync
CREATE OR REPLACE FUNCTION test_automatic_external_bot_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Test the automatic sync function
    PERFORM trigger_external_bot_sync();
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Automatic external bot sync test completed',
        'timestamp', NOW(),
        'instructions', 'Check external_bot_sync_log table for sync results (should show success/error, not cron_requested)'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION test_automatic_external_bot_sync() TO authenticated;

-- Update the cron requests view to show new status
DROP VIEW IF EXISTS cron_sync_requests;
CREATE OR REPLACE VIEW cron_sync_requests AS
SELECT 
    sync_timestamp,
    status,
    message,
    details,
    synced_count,
    CASE 
        WHEN status = 'success' THEN 'Automatic sync completed successfully'
        WHEN status = 'error' THEN 'Automatic sync failed - check details'
        WHEN status = 'cron_requested' THEN 'Legacy request - should not appear with new system'
        ELSE message
    END as action_needed
FROM external_bot_sync_log 
ORDER BY sync_timestamp DESC;

GRANT SELECT ON cron_sync_requests TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION trigger_external_bot_sync() IS 'Automatic cron function that performs actual external bot sync via HTTP call to edge function. Runs at 6 AM and 6 PM UTC daily.';
COMMENT ON FUNCTION test_automatic_external_bot_sync() IS 'Test function for the automatic external bot sync - performs actual sync and logs results';
COMMENT ON VIEW cron_sync_requests IS 'View to monitor automatic sync results and any legacy cron requests';

-- Show current cron jobs
SELECT 
    jobname,
    schedule,
    command,
    active
FROM cron.job 
WHERE jobname LIKE 'external-bot-sync%'
ORDER BY jobname;

-- Show instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== EXTERNAL BOT SYNC NOW FULLY AUTOMATIC ===';
    RAISE NOTICE 'Schedule: 6:00 AM UTC and 6:00 PM UTC daily';
    RAISE NOTICE 'The cron jobs now automatically:';
    RAISE NOTICE '1. Call the sync-external-bot-invoices edge function';
    RAISE NOTICE '2. Fetch data from external Odoo system';
    RAISE NOTICE '3. Log success/failure results';
    RAISE NOTICE '4. No manual intervention required';
    RAISE NOTICE '';
    RAISE NOTICE 'Test the automatic sync with: SELECT test_automatic_external_bot_sync();';
    RAISE NOTICE 'Monitor results in: SELECT * FROM external_bot_sync_log ORDER BY sync_timestamp DESC;';
    RAISE NOTICE '';
END;
$$;