-- Unified Inventory Management Functions
-- These functions support the new unified inventory approach

-- Function to get aggregated stock for a product across all variants
CREATE OR REPLACE FUNCTION get_unified_product_stock(
    p_agency_id UUID,
    p_product_name TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_stock INTEGER;
BEGIN
    -- Sum all quantities for this product across all color/size variants
    SELECT COALESCE(SUM(quantity), 0)
    INTO total_stock
    FROM public.external_inventory_management
    WHERE agency_id = p_agency_id
      AND product_name = p_product_name;
    
    RETURN total_stock;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_unified_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_product_stock TO service_role;

-- Function to get all products with their aggregated stock for an agency
CREATE OR REPLACE FUNCTION get_agency_unified_inventory(
    p_agency_id UUID
)
RETURNS TABLE (
    product_name TEXT,
    total_stock INTEGER,
    variant_count BIGINT,
    avg_unit_price NUMERIC,
    last_transaction_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        eim.product_name,
        COALESCE(SUM(eim.quantity), 0)::INTEGER as total_stock,
        COUNT(DISTINCT CONCAT(eim.color, '-', eim.size)) as variant_count,
        AVG(eim.unit_price) as avg_unit_price,
        MAX(eim.transaction_date) as last_transaction_date
    FROM public.external_inventory_management eim
    WHERE eim.agency_id = p_agency_id
    GROUP BY eim.product_name
    ORDER BY eim.product_name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_agency_unified_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_agency_unified_inventory TO service_role;

-- Updated view for unified inventory summary (optional - for reporting)
CREATE OR REPLACE VIEW public.unified_inventory_summary AS
SELECT 
    eim.agency_id,
    eim.product_name,
    p.name as product_display_name,
    p.sub_category,
    COALESCE(SUM(eim.quantity), 0) as current_stock,
    COUNT(DISTINCT CONCAT(eim.color, '-', eim.size)) as variant_count,
    AVG(eim.unit_price) as avg_unit_price,
    SUM(CASE WHEN eim.quantity > 0 THEN eim.quantity ELSE 0 END) as total_stock_in,
    ABS(SUM(CASE WHEN eim.quantity < 0 THEN eim.quantity ELSE 0 END)) as total_stock_out,
    COUNT(*) as transaction_count,
    MAX(eim.transaction_date) as last_transaction_date,
    MIN(eim.transaction_date) as first_transaction_date,
    CASE 
        WHEN COALESCE(SUM(eim.quantity), 0) <= 0 THEN 'out_of_stock'
        WHEN COALESCE(SUM(eim.quantity), 0) <= 5 THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status,
    COALESCE(SUM(eim.quantity), 0) * AVG(eim.unit_price) as total_value
FROM public.external_inventory_management eim
LEFT JOIN public.products p ON p.description = TRIM(REGEXP_REPLACE(eim.product_name, '^\[[^\]]*\]\s*', '', 'g'))
GROUP BY eim.agency_id, eim.product_name, p.name, p.sub_category;

-- Grant select permissions on the view
GRANT SELECT ON public.unified_inventory_summary TO authenticated;
GRANT SELECT ON public.unified_inventory_summary TO service_role;