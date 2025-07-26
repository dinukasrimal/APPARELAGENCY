-- Create odoo_invoices table for storing invoices synced from Odoo
CREATE TABLE public.odoo_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  odoo_id INTEGER NOT NULL UNIQUE, -- Odoo invoice ID
  odoo_name TEXT NOT NULL, -- Odoo invoice name/number
  partner_id INTEGER, -- Odoo partner ID
  partner_name TEXT NOT NULL,
  partner_email TEXT,
  partner_phone TEXT,
  partner_address TEXT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount_untaxed NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id INTEGER,
  currency_symbol TEXT DEFAULT '$',
  state TEXT NOT NULL DEFAULT 'draft', -- draft, open, paid, cancelled
  payment_state TEXT DEFAULT 'not_paid', -- not_paid, paid, partial
  invoice_type TEXT DEFAULT 'out_invoice', -- out_invoice, in_invoice, out_refund, in_refund
  reference TEXT, -- External reference
  notes TEXT,
  terms_conditions TEXT,
  agency_id UUID NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_status TEXT DEFAULT 'synced', -- synced, failed, pending
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create odoo_invoice_items table for invoice line items
CREATE TABLE public.odoo_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  odoo_invoice_id UUID NOT NULL REFERENCES public.odoo_invoices(id) ON DELETE CASCADE,
  odoo_product_id INTEGER,
  product_name TEXT NOT NULL,
  product_default_code TEXT,
  description TEXT,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  price_subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  price_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  price_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(5,2) DEFAULT 0, -- Discount percentage
  uom_id INTEGER, -- Unit of measure ID
  uom_name TEXT,
  sequence INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_odoo_invoices_odoo_id ON public.odoo_invoices(odoo_id);
CREATE INDEX idx_odoo_invoices_partner_id ON public.odoo_invoices(partner_id);
CREATE INDEX idx_odoo_invoices_invoice_date ON public.odoo_invoices(invoice_date);
CREATE INDEX idx_odoo_invoices_state ON public.odoo_invoices(state);
CREATE INDEX idx_odoo_invoices_payment_state ON public.odoo_invoices(payment_state);
CREATE INDEX idx_odoo_invoices_agency_id ON public.odoo_invoices(agency_id);
CREATE INDEX idx_odoo_invoices_sync_status ON public.odoo_invoices(sync_status);

CREATE INDEX idx_odoo_invoice_items_invoice_id ON public.odoo_invoice_items(odoo_invoice_id);
CREATE INDEX idx_odoo_invoice_items_product_id ON public.odoo_invoice_items(odoo_product_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_odoo_invoices_updated_at
  BEFORE UPDATE ON public.odoo_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_odoo_invoice_items_updated_at
  BEFORE UPDATE ON public.odoo_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.odoo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for odoo_invoices
CREATE POLICY "Users can view their agency odoo invoices" 
  ON public.odoo_invoices 
  FOR SELECT 
  USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

CREATE POLICY "Users can insert odoo invoices for their agency" 
  ON public.odoo_invoices 
  FOR INSERT 
  WITH CHECK (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

CREATE POLICY "Users can update odoo invoices for their agency" 
  ON public.odoo_invoices 
  FOR UPDATE 
  USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

CREATE POLICY "Users can delete odoo invoices for their agency" 
  ON public.odoo_invoices 
  FOR DELETE 
  USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
  );

-- RLS Policies for odoo_invoice_items
CREATE POLICY "Users can view their agency odoo invoice items" 
  ON public.odoo_invoice_items 
  FOR SELECT 
  USING (
    odoo_invoice_id IN (
      SELECT id FROM public.odoo_invoices 
      WHERE agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    )
  );

CREATE POLICY "Users can insert odoo invoice items for their agency" 
  ON public.odoo_invoice_items 
  FOR INSERT 
  WITH CHECK (
    odoo_invoice_id IN (
      SELECT id FROM public.odoo_invoices 
      WHERE agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    )
  );

CREATE POLICY "Users can update odoo invoice items for their agency" 
  ON public.odoo_invoice_items 
  FOR UPDATE 
  USING (
    odoo_invoice_id IN (
      SELECT id FROM public.odoo_invoices 
      WHERE agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    )
  );

CREATE POLICY "Users can delete odoo invoice items for their agency" 
  ON public.odoo_invoice_items 
  FOR DELETE 
  USING (
    odoo_invoice_id IN (
      SELECT id FROM public.odoo_invoices 
      WHERE agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superuser'
    )
  );

-- Create function to sync odoo invoices
CREATE OR REPLACE FUNCTION sync_odoo_invoices(
  p_agency_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  invoice_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- This function will be called from the application layer
  -- It returns a JSON with sync results
  result := json_build_object(
    'success', true,
    'message', 'Sync function created. Call from application layer.',
    'invoice_count', invoice_count,
    'error_count', error_count
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.odoo_invoices TO authenticated;
GRANT ALL ON public.odoo_invoice_items TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 