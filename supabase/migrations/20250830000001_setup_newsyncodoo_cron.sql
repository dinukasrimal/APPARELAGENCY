-- Schedule automatic Odoo -> external_inventory_management syncs (newsyncodoo)

CREATE EXTENSION IF NOT EXISTS http;

CREATE OR REPLACE FUNCTION trigger_newsyncodoo_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    response_status int;
    response_content text;
    sync_result jsonb;
BEGIN
    SELECT 
        (response).status,
        (response).content
    INTO 
        response_status,
        response_content
    FROM extensions.http((
        'POST',
        current_setting('app.supabase_url') || '/functions/v1/newsyncodoo',
        ARRAY[
            extensions.http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')),
            extensions.http_header('Content-Type', 'application/json')
        ],
        'application/json',
        '{}'
    )::http_request);

    BEGIN
        sync_result := response_content::jsonb;
    EXCEPTION WHEN OTHERS THEN
        sync_result := jsonb_build_object('success', false, 'message', 'Invalid JSON response', 'raw', response_content);
    END;

    IF response_status = 200 AND COALESCE((sync_result->>'success')::boolean, false) THEN
        INSERT INTO public.external_bot_sync_log (
            sync_timestamp,
            status,
            synced_count,
            message,
            details
        ) VALUES (
            NOW(),
            'success',
            COALESCE((sync_result->>'insertedTransactions')::int, 0),
            'newsyncodoo cron completed successfully',
            jsonb_build_object('sync_type', 'newsyncodoo', 'response', sync_result)
        );
    ELSE
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
            'newsyncodoo cron failed - HTTP ' || response_status,
            jsonb_build_object('sync_type', 'newsyncodoo', 'response', sync_result, 'raw', response_content)
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_newsyncodoo_sync() TO postgres;

-- Schedule cron at 08:00 and 20:00 Sri Lanka time (UTC+05:30) => 02:30 and 14:30 UTC
SELECT cron.schedule(
    'newsyncodoo-morning',
    '30 2 * * *',
    'SELECT trigger_newsyncodoo_sync();'
);

SELECT cron.schedule(
    'newsyncodoo-evening',
    '30 14 * * *',
    'SELECT trigger_newsyncodoo_sync();'
);

CREATE OR REPLACE FUNCTION test_newsyncodoo_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM trigger_newsyncodoo_sync();
    RETURN jsonb_build_object(
        'success', true,
        'message', 'newsyncodoo cron executed manually',
        'timestamp', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION test_newsyncodoo_cron() TO authenticated;
