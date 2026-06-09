-- Swap duplicate BLACK VEST 75 references so the duplicate product can be deleted.
-- Old product: BLACK VEST 75 / 494a3b0d-2564-4848-979a-d70208e1c443
-- Keep product: BLACK VEST SLEEVE LESS 75 / 070e19b7-ca4c-4b47-b746-05fde1d96457

DO $$
DECLARE
  old_product_id CONSTANT UUID := '494a3b0d-2564-4848-979a-d70208e1c443';
  keep_product_id CONSTANT UUID := '070e19b7-ca4c-4b47-b746-05fde1d96457';
  remaining_rows INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = old_product_id) THEN
    RAISE NOTICE 'Old product % does not exist. Nothing to swap.', old_product_id;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = keep_product_id) THEN
    RAISE EXCEPTION 'Replacement product % does not exist.', keep_product_id;
  END IF;

  UPDATE public.external_inventory_management
  SET matched_product_id = keep_product_id
  WHERE matched_product_id = old_product_id;

  UPDATE public.internal_stock_movements
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  UPDATE public.invoice_items
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  UPDATE public.product_variants
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  UPDATE public.purchase_order_items
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  UPDATE public.return_items
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  UPDATE public.sales_order_items
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  UPDATE public.stock_adjustments
  SET product_id = keep_product_id
  WHERE product_id = old_product_id;

  SELECT
    (
      (SELECT COUNT(*) FROM public.external_inventory_management WHERE matched_product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.internal_stock_movements WHERE product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.invoice_items WHERE product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.product_variants WHERE product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.purchase_order_items WHERE product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.return_items WHERE product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.sales_order_items WHERE product_id = old_product_id) +
      (SELECT COUNT(*) FROM public.stock_adjustments WHERE product_id = old_product_id)
    )
  INTO remaining_rows;

  IF remaining_rows > 0 THEN
    RAISE EXCEPTION 'Product % is still referenced by % rows.', old_product_id, remaining_rows;
  END IF;

  RAISE NOTICE 'Swapped product references from % to %.', old_product_id, keep_product_id;
END;
$$;
