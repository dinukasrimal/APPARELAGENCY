-- Unique Numbering System for Sales Orders and Invoices
-- Run this SQL in your Supabase SQL Editor

-- 1. Add numbering columns to existing tables
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- 2. Create a function to generate sales order numbers
CREATE OR REPLACE FUNCTION generate_sales_order_number(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_code TEXT;
    next_number INTEGER;
    order_number TEXT;
BEGIN
    -- Get agency code (last 4 digits of agency ID)
    agency_code := RIGHT(agency_id::TEXT, 4);
    
    -- Get the next number for this agency
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 9) AS INTEGER)), 99)
    INTO next_number
    FROM sales_orders 
    WHERE order_number LIKE agency_code || '-%';
    
    -- Generate the order number
    order_number := agency_code || '-' || LPAD((next_number + 1)::TEXT, 5, '0');
    
    RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_code TEXT;
    next_number INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get agency code (last 4 digits of agency ID)
    agency_code := RIGHT(agency_id::TEXT, 4);
    
    -- Get the next number for this agency
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9) AS INTEGER)), 99)
    INTO next_number
    FROM invoices 
    WHERE invoice_number LIKE agency_code || '-INV%';
    
    -- Generate the invoice number
    invoice_number := agency_code || '-INV' || LPAD((next_number + 1)::TEXT, 5, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- 4. Create triggers to automatically generate numbers
CREATE OR REPLACE FUNCTION set_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_sales_order_number(NEW.agency_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number(NEW.agency_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers
DROP TRIGGER IF EXISTS trigger_set_sales_order_number ON sales_orders;
CREATE TRIGGER trigger_set_sales_order_number
    BEFORE INSERT ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_sales_order_number();

DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- 6. Update existing records with numbers (run this once)
-- This will generate numbers for existing sales orders and invoices
UPDATE sales_orders 
SET order_number = generate_sales_order_number(agency_id)
WHERE order_number IS NULL;

UPDATE invoices 
SET invoice_number = generate_invoice_number(agency_id)
WHERE invoice_number IS NULL;

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_agency_order_number ON sales_orders(agency_id, order_number);
CREATE INDEX IF NOT EXISTS idx_invoices_agency_invoice_number ON invoices(agency_id, invoice_number); 