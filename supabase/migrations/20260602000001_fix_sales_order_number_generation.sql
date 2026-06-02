-- Fix sales order numbering so the numeric suffix is parsed from the part
-- after the dash. The previous function read from character 9, which only
-- captured the last two digits for values like abcd-00100.
CREATE OR REPLACE FUNCTION public.generate_sales_order_number(agency_id UUID)
RETURNS TEXT AS $$
DECLARE
    agency_code TEXT;
    next_number INTEGER;
    order_number TEXT;
BEGIN
    agency_code := RIGHT(agency_id::TEXT, 4);

    SELECT COALESCE(MAX(CAST(SPLIT_PART(order_number, '-', 2) AS INTEGER)), 99)
    INTO next_number
    FROM public.sales_orders
    WHERE order_number ~ ('^' || agency_code || '-[0-9]+$');

    order_number := agency_code || '-' || LPAD((next_number + 1)::TEXT, 5, '0');

    RETURN order_number;
END;
$$ LANGUAGE plpgsql;
