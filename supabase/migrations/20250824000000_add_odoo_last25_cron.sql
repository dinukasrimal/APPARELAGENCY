-- Migration: Add pg_cron jobs for automatic Odoo last-25 syncs

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_odoo_last25_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url text;
    service_key text;
    request_id bigint;
BEGIN
    BEGIN
        supabase_url := current_setting('app.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
        supabase_url := NULL;
    END;

    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://ejpwmgluazqcczrpwjlo.supabase.co';
    END IF;

    BEGIN
        service_key := current_setting('app.supabase_service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
        service_key := NULL;
    END;

    IF service_key IS NULL OR service_key = '' THEN
        service_key := current_setting('app.supabase_service_key', true);
    END IF;

    IF service_key IS NULL OR service_key = '' THEN
        RAISE EXCEPTION 'Service role key not configured. Please run setup_sync_config.';
    END IF;

    INSERT INTO public.external_bot_sync_log (
        sync_timestamp,
        status,
        synced_count,
        message,
        details
    ) VALUES (
        NOW(),
        'cron_initiated',
        0,
        'pg_cron initiated newsyncodoo run',
        jsonb_build_object(
            'sync_type', 'newsyncodoo',
            'cron_function', 'trigger_odoo_last25_sync'
        )
    );

    SELECT net.http_post(
        url := supabase_url || '/functions/v1/newsyncodoo',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
            'manualTrigger', false,
            'sync_trigger', 'pg_cron_odoo',
            'metadata', jsonb_build_object(
                'source', 'pg_cron',
                'cron_function', 'trigger_odoo_last25_sync'
            )
        )::text
    ) INTO request_id;

    UPDATE public.external_bot_sync_log
    SET
        message = 'newsyncodoo request dispatched, ID: ' || COALESCE(request_id::text, 'unknown'),
        details = jsonb_build_object(
            'request_id', request_id,
            'sync_type', 'newsyncodoo',
            'cron_function', 'trigger_odoo_last25_sync'
        )
    WHERE sync_timestamp = (
        SELECT MAX(sync_timestamp)
        FROM public.external_bot_sync_log
        WHERE status = 'cron_initiated'
          AND (details->>'sync_type') = 'newsyncodoo'
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
        'cron_error',
        0,
        'newsyncodoo cron failed: ' || SQLERRM,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'sync_type', 'newsyncodoo'
        )
    );
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'odoo-last25-sync-morning') THEN
        PERFORM cron.unschedule('odoo-last25-sync-morning');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'odoo-last25-sync-evening') THEN
        PERFORM cron.unschedule('odoo-last25-sync-evening');
    END IF;
END $$;

SELECT cron.schedule(
    'odoo-last25-sync-morning',
    '0 2 * * *',
    'SELECT trigger_odoo_last25_sync();'
);

SELECT cron.schedule(
    'odoo-last25-sync-evening',
    '0 16 * * *',
    'SELECT trigger_odoo_last25_sync();'
);

GRANT EXECUTE ON FUNCTION trigger_odoo_last25_sync() TO postgres;
