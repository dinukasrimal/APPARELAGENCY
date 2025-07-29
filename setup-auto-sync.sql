-- Setup script to complete auto-sync and company returns stock-out functionality

-- 1. Update webhook URLs for external invoice sync
CREATE OR REPLACE FUNCTION trigger_external_invoice_sync()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  payload JSON;
BEGIN
  webhook_url := 'https://ejpwmgluazqcczrpwjlo.supabase.co/functions/v1/auto-sync-external-inventory';
  
  payload := json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    'timestamp', NOW()
  );

  RAISE NOTICE 'External invoice sync trigger fired for invoice: % with webhook URL: %', NEW.id, webhook_url;

  -- Insert into queue for processing
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
  ) ON CONFLICT (invoice_id) DO UPDATE SET
    payload = EXCLUDED.payload,
    status = 'pending',
    created_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create company returns stock-out trigger
CREATE OR REPLACE FUNCTION process_company_return_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'processed'
  IF NEW.status = 'processed' AND (OLD.status IS NULL OR OLD.status != 'processed') THEN
    
    RAISE NOTICE 'Processing company return % for inventory stock-out', NEW.id;
    
    -- Create inventory transactions for each return item
    INSERT INTO inventory_transactions (
      product_id,
      product_name,
      color,
      size,
      transaction_type,
      quantity,
      reference_id,
      reference_name,
      user_id,
      agency_id,
      notes,
      created_at
    )
    SELECT 
      p.id as product_id,
      ri.product_name,
      COALESCE(ri.color, '') as color,
      COALESCE(ri.size, '') as size,
      'company_return' as transaction_type,
      -ri.quantity_returned as quantity, -- Negative for stock-out
      NEW.id::text as reference_id,
      'Company Return #' || NEW.id as reference_name,
      NEW.processed_by as user_id,
      NEW.agency_id,
      'Automatic stock-out for company return. Reason: ' || COALESCE(NEW.reason, 'No reason provided') as notes,
      NOW() as created_at
    FROM return_items ri
    LEFT JOIN products p ON p.name = ri.product_name
    WHERE ri.return_id = NEW.id
      AND ri.quantity_returned > 0;

    DECLARE
      transaction_count INTEGER;
    BEGIN
      GET DIAGNOSTICS transaction_count = ROW_COUNT;
      RAISE NOTICE 'Created % inventory transactions for company return %', transaction_count, NEW.id;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for company returns
DROP TRIGGER IF EXISTS company_return_inventory_trigger ON returns;
CREATE TRIGGER company_return_inventory_trigger
  AFTER UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION process_company_return_inventory();

DROP TRIGGER IF EXISTS company_return_inventory_insert_trigger ON returns;
CREATE TRIGGER company_return_inventory_insert_trigger
  AFTER INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION process_company_return_inventory();

-- 3. Create scheduled sync configuration
INSERT INTO app_settings (key, value, description) VALUES 
('auto_sync_webhook_url', 'https://ejpwmgluazqcczrpwjlo.supabase.co/functions/v1/scheduled-external-sync', 'URL for scheduled external sync Edge Function'),
('auto_sync_enabled', 'true', 'Enable automatic external invoice synchronization'),
('sync_frequency_minutes', '10', 'How often to run scheduled sync in minutes')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- 4. Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_type 
ON inventory_transactions(reference_id, transaction_type) 
WHERE transaction_type IN ('company_return', 'invoice_creation');

CREATE INDEX IF NOT EXISTS idx_external_invoice_sync_queue_invoice_id 
ON external_invoice_sync_queue(invoice_id);

-- 5. Comments for documentation
COMMENT ON FUNCTION process_company_return_inventory() IS 
'Automatically creates negative inventory transactions when company returns are processed. Ensures company returns stock-out inventory appropriately.';

COMMENT ON TRIGGER company_return_inventory_trigger ON returns IS 
'Automatically creates inventory stock-out transactions when company returns are processed.';

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '=== AUTO-SYNC SETUP COMPLETED ===';
  RAISE NOTICE 'Edge Functions deployed: auto-sync-external-inventory, scheduled-external-sync';
  RAISE NOTICE 'Database triggers updated with real webhook URLs';
  RAISE NOTICE 'Company returns now automatically stock-out inventory when processed';
  RAISE NOTICE 'Stock-out sources: Internal sales invoices + Company returns';
  RAISE NOTICE '=======================================';
END $$;