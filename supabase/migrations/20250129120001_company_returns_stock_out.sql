-- Create automatic stock-out functionality for company returns
-- This trigger creates negative inventory transactions when company returns are processed

-- Create function to process company returns and create inventory transactions
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
      -- Try to get product_id from products table, use NULL if not found
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
      AND ri.quantity_returned > 0; -- Only process items with positive quantities

    -- Log the number of transactions created
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

-- Create the trigger on returns table
DROP TRIGGER IF EXISTS company_return_inventory_trigger ON returns;
CREATE TRIGGER company_return_inventory_trigger
  AFTER UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION process_company_return_inventory();

-- Also create trigger for new returns that are directly created as 'processed'
DROP TRIGGER IF EXISTS company_return_inventory_insert_trigger ON returns;
CREATE TRIGGER company_return_inventory_insert_trigger
  AFTER INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION process_company_return_inventory();

-- Create a function to manually process existing returns (for backfill if needed)
CREATE OR REPLACE FUNCTION backfill_company_return_inventory(return_id UUID)
RETURNS INTEGER AS $$
DECLARE
  return_record RECORD;
  transaction_count INTEGER := 0;
BEGIN
  -- Get the return record
  SELECT * INTO return_record 
  FROM returns 
  WHERE id = return_id AND status = 'processed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return % not found or not in processed status', return_id;
  END IF;

  -- Create inventory transactions for the return items
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
    -ri.quantity_returned as quantity,
    return_record.id::text as reference_id,
    'Company Return #' || return_record.id as reference_name,
    return_record.processed_by as user_id,
    return_record.agency_id,
    'Manual backfill for company return. Reason: ' || COALESCE(return_record.reason, 'No reason provided') as notes,
    NOW() as created_at
  FROM return_items ri
  LEFT JOIN products p ON p.name = ri.product_name
  WHERE ri.return_id = return_record.id
    AND ri.quantity_returned > 0
    -- Avoid duplicates
    AND NOT EXISTS (
      SELECT 1 FROM inventory_transactions it
      WHERE it.reference_id = return_record.id::text
        AND it.transaction_type = 'company_return'
        AND it.product_name = ri.product_name
    );

  GET DIAGNOSTICS transaction_count = ROW_COUNT;
  
  RAISE NOTICE 'Backfilled % inventory transactions for company return %', transaction_count, return_id;
  
  RETURN transaction_count;
END;
$$ LANGUAGE plpgsql;

-- Add helper function to check if a return has been processed for inventory
CREATE OR REPLACE FUNCTION is_return_processed_for_inventory(return_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM inventory_transactions
    WHERE reference_id = return_id::text
      AND transaction_type = 'company_return'
  );
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION process_company_return_inventory() IS 
'Automatically creates negative inventory transactions when company returns are marked as processed. This ensures company returns stock-out inventory appropriately.';

COMMENT ON TRIGGER company_return_inventory_trigger ON returns IS 
'Automatically creates inventory stock-out transactions when company returns are processed.';

COMMENT ON FUNCTION backfill_company_return_inventory(UUID) IS 
'Manual function to create inventory transactions for existing processed returns. Use for backfilling historical data.';

COMMENT ON FUNCTION is_return_processed_for_inventory(UUID) IS 
'Helper function to check if a return has already been processed for inventory transactions.';

-- Create index to improve performance of duplicate checking
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_type 
ON inventory_transactions(reference_id, transaction_type) 
WHERE transaction_type = 'company_return';