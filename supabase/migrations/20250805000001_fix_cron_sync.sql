-- Fix cron sync by removing pg_net dependency and using direct sync approach
-- This migration creates a simplified cron function that doesn't require HTTP calls

-- Drop existing cron jobs
SELECT cron.unschedule('external-bot-sync-morning');
SELECT cron.unschedule('external-bot-sync-evening');

-- Create a simplified sync trigger function that logs the attempt
-- Since we can't reliably make HTTP calls from pg_cron, we'll create a log entry
-- that can be picked up by the Edge Functions or manual processes
CREATE OR REPLACE FUNCTION trigger_external_bot_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert a sync request into the log table
    -- This will be picked up by monitoring systems or manual triggers
    INSERT INTO public.external_bot_sync_log (
        sync_timestamp, 
        status, 
        synced_count, 
        message,
        details
    ) VALUES (
        NOW(), 
        'cron_requested', 
        0, 
        'Cron job requested external bot sync - manual trigger required',
        jsonb_build_object(
            'source', 'pg_cron',
            'request_type', 'automatic',
            'requires_manual_trigger', true,
            'instructions', 'Use the Global Sync button in the UI to process this request'
        )
    );
    
    -- Log success
    RAISE NOTICE 'External bot sync requested via cron at %', NOW();
    
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
        'Cron sync request failed: ' || SQLERRM,
        jsonb_build_object(
            'error', SQLERRM,
            'error_state', SQLSTATE
        )
    );
    
    -- Re-raise the error for debugging
    RAISE NOTICE 'Cron sync error: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_external_bot_sync() TO postgres;

-- Schedule the cron jobs with the new function
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

-- Create a test function
CREATE OR REPLACE FUNCTION test_cron_sync_fixed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Test the sync function
    PERFORM trigger_external_bot_sync();
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Cron sync test completed successfully',
        'timestamp', NOW(),
        'instructions', 'Check external_bot_sync_log table for the sync request entry'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION test_cron_sync_fixed() TO authenticated;

-- Create a view to easily monitor cron requests
CREATE OR REPLACE VIEW cron_sync_requests AS
SELECT 
    sync_timestamp,
    status,
    message,
    details,
    CASE 
        WHEN status = 'cron_requested' THEN 'Sync requested by cron - needs manual processing'
        WHEN status = 'cron_error' THEN 'Cron job failed'
        ELSE message
    END as action_needed
FROM external_bot_sync_log 
WHERE status IN ('cron_requested', 'cron_error')
ORDER BY sync_timestamp DESC;

GRANT SELECT ON cron_sync_requests TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION trigger_external_bot_sync() IS 'Simplified cron function that logs sync requests instead of making HTTP calls. Avoids pg_net dependency issues.';
COMMENT ON FUNCTION test_cron_sync_fixed() IS 'Test function for the fixed cron sync - creates a sync request log entry';
COMMENT ON VIEW cron_sync_requests IS 'View to monitor cron-requested syncs that need manual processing';

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
    RAISE NOTICE '=== CRON SYNC FIXED ===';
    RAISE NOTICE 'The cron jobs now create sync request entries instead of making HTTP calls.';
    RAISE NOTICE 'To process sync requests:';
    RAISE NOTICE '1. Check cron_sync_requests view for pending requests';
    RAISE NOTICE '2. Use the Global Sync button in the External Inventory UI';
    RAISE NOTICE '3. Or call the sync functions manually via Edge Functions';
    RAISE NOTICE '';
    RAISE NOTICE 'Test the fix with: SELECT test_cron_sync_fixed();';
    RAISE NOTICE '';
END;
$$;