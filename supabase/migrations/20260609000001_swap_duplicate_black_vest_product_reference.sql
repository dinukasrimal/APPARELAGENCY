-- Swap duplicate BLACK VEST SLEEVE LESS 70 references so the duplicate product can be deleted.
-- Old product: df726cfe-c473-4453-a226-906fb8e4e6d0
-- Keep product: 178db5d9-a1d7-41b2-87f6-5ffbdd0869f7

DO $$
DECLARE
  old_product_id CONSTANT UUID := 'df726cfe-c473-4453-a226-906fb8e4e6d0';
  keep_product_id CONSTANT UUID := '178db5d9-a1d7-41b2-87f6-5ffbdd0869f7';
  swapped_rows INTEGER;
  remaining_rows INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = old_product_id) THEN
    RAISE NOTICE 'Old product % does not exist. Nothing to swap.', old_product_id;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = keep_product_id) THEN
    RAISE EXCEPTION 'Replacement product % does not exist.', keep_product_id;
  END IF;

  UPDATE public.sales_order_items
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  GET DIAGNOSTICS swapped_rows = ROW_COUNT;

  SELECT COUNT(*)
  INTO remaining_rows
  FROM public.sales_order_items
  WHERE product_id = old_product_id;

  IF remaining_rows > 0 THEN
    RAISE EXCEPTION 'Product % is still referenced by % sales_order_items rows.', old_product_id, remaining_rows;
  END IF;

  RAISE NOTICE 'Swapped % sales_order_items rows from % to %.', swapped_rows, old_product_id, keep_product_id;
END;
$$;
