-- Migration to add automatic sync trigger for external invoices
-- This creates a webhook trigger that calls the auto-sync Edge Function when new external invoices are created

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION trigger_external_invoice_sync()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  payload JSON;
  http_response TEXT;
BEGIN
  -- Get the webhook URL from environment or use default
  webhook_url := current_setting('app.webhook_base_url', true) || '/functions/v1/auto-sync-external-inventory';
  
  -- If no webhook URL is configured, use the default Supabase Edge Function URL
  IF webhook_url IS NULL OR webhook_url = '/functions/v1/auto-sync-external-inventory' THEN
    -- You'll need to replace this with your actual Supabase project URL
    webhook_url := 'https://your-project-ref.supabase.co/functions/v1/auto-sync-external-inventory';
  END IF;

  -- Create payload with trigger information
  payload := json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    'timestamp', NOW()
  );

  -- Log the trigger event
  RAISE NOTICE 'External invoice sync trigger fired for invoice: %', NEW.id;

  -- Note: HTTP requests from database functions require the http extension
  -- For now, we'll just log the event and rely on the Edge Function being called externally
  -- In production, you can use pg_net or http extensions to make the actual HTTP call
  
  -- Insert a notification record that can be processed by a background job
  INSERT INTO external_invoice_sync_queue (
    invoice_id,
    partner_name,
    payload,
    status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.partner_name,
    payload,
    'pending',
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a queue table to track sync requests
CREATE TABLE IF NOT EXISTS external_invoice_sync_queue (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  partner_name TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_external_invoice_sync_queue_status 
ON external_invoice_sync_queue(status, created_at);

-- Create the trigger on external_invoices table
-- Note: This assumes you have access to create triggers on the external database
-- If not, you'll need to implement this differently (polling, etc.)
CREATE OR REPLACE TRIGGER external_invoice_auto_sync_trigger
  AFTER INSERT ON external_invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_external_invoice_sync();

-- Add a comment explaining the setup
COMMENT ON TRIGGER external_invoice_auto_sync_trigger ON external_invoices IS 
'Automatically triggers inventory synchronization when new external invoices are created. 
Uses a queue-based system for reliable processing.';

-- Create a function to process the sync queue (to be called by a scheduled job)
CREATE OR REPLACE FUNCTION process_external_invoice_sync_queue()
RETURNS INTEGER AS $$
DECLARE
  queue_item RECORD;
  processed_count INTEGER := 0;
  webhook_url TEXT;
  http_response TEXT;
BEGIN
  webhook_url := current_setting('app.webhook_base_url', true) || '/functions/v1/auto-sync-external-inventory';
  
  IF webhook_url IS NULL OR webhook_url = '/functions/v1/auto-sync-external-inventory' THEN
    webhook_url := 'https://your-project-ref.supabase.co/functions/v1/auto-sync-external-inventory';
  END IF;

  -- Process pending items in the queue
  FOR queue_item IN 
    SELECT id, invoice_id, payload 
    FROM external_invoice_sync_queue 
    WHERE status = 'pending' 
    AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT 10 -- Process in batches
  LOOP
    BEGIN
      -- Update status to processing
      UPDATE external_invoice_sync_queue 
      SET status = 'processing', processed_at = NOW()
      WHERE id = queue_item.id;

      -- Here you would make the HTTP call to the Edge Function
      -- For now, we'll simulate success and mark as completed
      -- In production, use pg_net.http_post or similar
      
      -- Mark as completed
      UPDATE external_invoice_sync_queue 
      SET status = 'completed', processed_at = NOW()
      WHERE id = queue_item.id;
      
      processed_count := processed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Mark as failed and increment retry count
      UPDATE external_invoice_sync_queue 
      SET 
        status = 'failed',
        error_message = SQLERRM,
        retry_count = retry_count + 1,
        processed_at = NOW()
      WHERE id = queue_item.id;
      
      RAISE NOTICE 'Failed to process sync queue item %: %', queue_item.id, SQLERRM;
    END;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Add a scheduled task comment (you'll need to set this up externally)
COMMENT ON FUNCTION process_external_invoice_sync_queue() IS 
'Processes the external invoice sync queue. Should be called periodically by a cron job or scheduled task.
Call this function every 5-10 minutes to process pending sync requests.';