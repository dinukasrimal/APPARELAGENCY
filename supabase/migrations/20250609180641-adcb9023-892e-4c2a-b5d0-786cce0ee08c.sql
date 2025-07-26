
-- Add 'closed' status to the sales_order_status enum
ALTER TYPE sales_order_status ADD VALUE 'closed';

-- Add a column to track total invoiced amount for each sales order
ALTER TABLE sales_orders ADD COLUMN total_invoiced NUMERIC DEFAULT 0;

-- Create a function to update total_invoiced when invoices are created
CREATE OR REPLACE FUNCTION update_sales_order_invoiced_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the total_invoiced amount for the related sales order
  IF NEW.sales_order_id IS NOT NULL THEN
    UPDATE sales_orders 
    SET total_invoiced = (
      SELECT COALESCE(SUM(total), 0) 
      FROM invoices 
      WHERE sales_order_id = NEW.sales_order_id
    )
    WHERE id = NEW.sales_order_id;
    
    -- Update the sales order status based on invoiced amount
    UPDATE sales_orders 
    SET status = CASE 
      WHEN total_invoiced >= total THEN 'invoiced'
      WHEN total_invoiced > 0 THEN 'partially_invoiced'
      ELSE status
    END
    WHERE id = NEW.sales_order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update sales order invoiced amount
CREATE TRIGGER trigger_update_sales_order_invoiced_amount
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_invoiced_amount();

-- Update existing sales orders to calculate their total_invoiced amounts
UPDATE sales_orders 
SET total_invoiced = (
  SELECT COALESCE(SUM(total), 0) 
  FROM invoices 
  WHERE sales_order_id = sales_orders.id
);

-- Update the quarterly targets function to use invoice date instead of created_at
CREATE OR REPLACE FUNCTION public.update_quarterly_targets()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  current_quarter TEXT;
  current_year INTEGER;
  invoice_quarter TEXT;
  invoice_year INTEGER;
  product_category TEXT;
  target_agency_id UUID;
BEGIN
  -- Get the quarter and year from invoice creation date
  invoice_year := EXTRACT(YEAR FROM NEW.created_at);
  
  CASE 
    WHEN EXTRACT(MONTH FROM NEW.created_at) BETWEEN 1 AND 3 THEN invoice_quarter := 'Q1';
    WHEN EXTRACT(MONTH FROM NEW.created_at) BETWEEN 4 AND 6 THEN invoice_quarter := 'Q2';
    WHEN EXTRACT(MONTH FROM NEW.created_at) BETWEEN 7 AND 9 THEN invoice_quarter := 'Q3';
    ELSE invoice_quarter := 'Q4';
  END CASE;
  
  -- Update targets for each product category in the invoice
  FOR product_category, target_agency_id IN
    SELECT DISTINCT p.category, NEW.agency_id
    FROM invoice_items ii
    JOIN products p ON ii.product_id::UUID = p.id
    WHERE ii.invoice_id = NEW.id
  LOOP
    -- Update agency-specific targets
    UPDATE quarterly_targets 
    SET achieved_amount = achieved_amount + (
      SELECT COALESCE(SUM(ii.total), 0)
      FROM invoice_items ii
      JOIN products p ON ii.product_id::UUID = p.id
      WHERE ii.invoice_id = NEW.id AND p.category = product_category
    )
    WHERE quarter::TEXT = invoice_quarter 
      AND year = invoice_year 
      AND product_category = product_category
      AND agency_id = target_agency_id;
      
    -- Update global targets (where agency_id is null)
    UPDATE quarterly_targets 
    SET achieved_amount = achieved_amount + (
      SELECT COALESCE(SUM(ii.total), 0)
      FROM invoice_items ii
      JOIN products p ON ii.product_id::UUID = p.id
      WHERE ii.invoice_id = NEW.id AND p.category = product_category
    )
    WHERE quarter::TEXT = invoice_quarter 
      AND year = invoice_year 
      AND product_category = product_category
      AND agency_id IS NULL;
  END LOOP;
  
  RETURN NEW;
END;
$function$;
