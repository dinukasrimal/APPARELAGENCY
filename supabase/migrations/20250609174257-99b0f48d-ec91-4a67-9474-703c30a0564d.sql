
-- Create inventory_transactions table for tracking stock movements
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('grn_acceptance', 'invoice_creation', 'customer_return', 'company_return', 'adjustment')),
  quantity INTEGER NOT NULL, -- positive for additions, negative for deductions
  reference_id TEXT NOT NULL, -- ID of the related GRN, Invoice, or Return
  reference_name TEXT NOT NULL, -- For display purposes
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Create inventory_items table for current stock levels
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  agency_id UUID NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  minimum_stock INTEGER DEFAULT 0,
  maximum_stock INTEGER,
  UNIQUE(product_id, color, size, agency_id)
);

-- Create function to update inventory stock levels based on transactions
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update inventory item
  INSERT INTO public.inventory_items (
    product_id, 
    product_name, 
    color, 
    size, 
    current_stock, 
    agency_id, 
    last_updated
  )
  VALUES (
    NEW.product_id,
    NEW.product_name,
    NEW.color,
    NEW.size,
    NEW.quantity,
    NEW.agency_id,
    now()
  )
  ON CONFLICT (product_id, color, size, agency_id)
  DO UPDATE SET
    current_stock = inventory_items.current_stock + NEW.quantity,
    last_updated = now(),
    product_name = NEW.product_name; -- Update name in case it changed
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update inventory when transactions are inserted
CREATE TRIGGER inventory_transaction_trigger
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();

-- Update quarterly targets to properly track achievement from invoices
CREATE OR REPLACE FUNCTION update_quarterly_targets()
RETURNS TRIGGER AS $$
DECLARE
  current_quarter TEXT;
  current_year INTEGER;
  invoice_quarter TEXT;
  invoice_year INTEGER;
  product_category TEXT;
  target_agency_id UUID;
BEGIN
  -- Get the current quarter and year from invoice creation
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
$$ LANGUAGE plpgsql;

-- Create trigger to update quarterly targets when invoices are created
DROP TRIGGER IF EXISTS update_targets_on_invoice ON public.invoices;
CREATE TRIGGER update_targets_on_invoice
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_targets();

-- Add RLS policies for inventory tables
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Policies for inventory_transactions
CREATE POLICY "Users can view their agency inventory transactions" 
  ON public.inventory_transactions 
  FOR SELECT 
  USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

CREATE POLICY "Users can create inventory transactions for their agency" 
  ON public.inventory_transactions 
  FOR INSERT 
  WITH CHECK (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

-- Policies for inventory_items
CREATE POLICY "Users can view their agency inventory items" 
  ON public.inventory_items 
  FOR SELECT 
  USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

CREATE POLICY "Users can update their agency inventory items" 
  ON public.inventory_items 
  FOR ALL 
  USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );
