-- Create delivery system tables

-- 1. Create deliveries table to track delivery status and details
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  delivery_agent_id UUID NOT NULL REFERENCES auth.users(id),
  agency_id UUID NOT NULL REFERENCES public.agencies(id),
  
  -- Delivery status and tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'out_for_delivery', 'delivered', 'failed', 'cancelled')),
  scheduled_date DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery location and proof
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  delivery_signature TEXT, -- Base64 encoded signature
  delivery_notes TEXT,
  
  -- Customer details at delivery
  received_by_name VARCHAR(255),
  received_by_phone VARCHAR(20),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice_id ON public.deliveries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_agent ON public.deliveries(delivery_agent_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON public.deliveries(agency_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON public.deliveries(scheduled_date);

-- 3. Create delivery_items table to track individual items in delivery
CREATE TABLE IF NOT EXISTS public.delivery_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES public.invoice_items(id),
  
  -- Item details at delivery time
  product_id UUID NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  color VARCHAR(100),
  size VARCHAR(50),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Item condition at delivery
  item_condition VARCHAR(20) DEFAULT 'good' CHECK (item_condition IN ('good', 'damaged', 'missing')),
  condition_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create index for delivery items
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_invoice_item ON public.delivery_items(invoice_item_id);

-- 5. Enable RLS (Row Level Security)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for deliveries
-- Allow agents to manage deliveries assigned to them
CREATE POLICY "Agents can manage their deliveries"
  ON public.deliveries
  FOR ALL
  USING (
    delivery_agent_id = auth.uid()
    OR created_by = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  );

-- Allow agencies to view deliveries for their invoices
CREATE POLICY "Agencies can view their deliveries"
  ON public.deliveries
  FOR SELECT
  USING (
    agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  );

-- Allow superusers to manage all deliveries
CREATE POLICY "Superusers can manage all deliveries"
  ON public.deliveries
  FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
  );

-- 7. Create RLS policies for delivery_items
CREATE POLICY "Users can manage delivery items based on delivery access"
  ON public.delivery_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d 
      WHERE d.id = delivery_items.delivery_id 
      AND (
        d.delivery_agent_id = auth.uid()
        OR d.created_by = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superuser'
        OR d.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- 8. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deliveries_updated_at();

-- 9. Create function to automatically create delivery record when invoice is created
CREATE OR REPLACE FUNCTION public.create_delivery_for_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Create delivery record for new invoice
  INSERT INTO public.deliveries (
    invoice_id,
    delivery_agent_id,
    agency_id,
    status,
    created_by
  ) VALUES (
    NEW.id,
    NEW.created_by, -- Initially assign to whoever created the invoice
    NEW.agency_id,
    'pending',
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create deliveries for new invoices
CREATE TRIGGER trigger_create_delivery_for_invoice
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.create_delivery_for_invoice();

-- 10. Add comments for documentation
COMMENT ON TABLE public.deliveries IS 'Tracks delivery status and details for invoices';
COMMENT ON COLUMN public.deliveries.status IS 'Delivery status: pending, out_for_delivery, delivered, failed, cancelled';
COMMENT ON COLUMN public.deliveries.delivery_signature IS 'Base64 encoded signature captured at delivery';
COMMENT ON COLUMN public.deliveries.delivery_latitude IS 'GPS latitude where delivery was completed';
COMMENT ON COLUMN public.deliveries.delivery_longitude IS 'GPS longitude where delivery was completed';

COMMENT ON TABLE public.delivery_items IS 'Tracks individual items within each delivery';
COMMENT ON COLUMN public.delivery_items.item_condition IS 'Condition of item at delivery: good, damaged, missing';

-- 11. Create a view for delivery summary
CREATE OR REPLACE VIEW public.delivery_summary AS
SELECT 
  d.id,
  d.invoice_id,
  d.status,
  d.scheduled_date,
  d.delivered_at,
  d.delivery_agent_id,
  d.agency_id,
  i.customer_name,
  i.total as invoice_total,
  COUNT(di.id) as total_items,
  u.name as delivery_agent_name
FROM public.deliveries d
JOIN public.invoices i ON d.invoice_id = i.id
LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
LEFT JOIN public.profiles u ON d.delivery_agent_id = u.id
GROUP BY d.id, d.invoice_id, d.status, d.scheduled_date, d.delivered_at, 
         d.delivery_agent_id, d.agency_id, i.customer_name, i.total, u.name;

-- Success message
SELECT 'Delivery system tables created successfully!' AS status;