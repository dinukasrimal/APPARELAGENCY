-- Fix: allow authenticated users to delete sales_order_items
-- Root cause: without a DELETE policy, Supabase silently skips the delete
-- on every edit, causing items to accumulate and appear doubled/tripled.
--
-- Run this in Supabase SQL Editor.

DROP POLICY IF EXISTS "authenticated_sales_order_items_delete" ON sales_order_items;

CREATE POLICY "authenticated_sales_order_items_delete" ON sales_order_items
  FOR DELETE TO authenticated
  USING (true);

-- Also ensure SELECT and INSERT policies exist (they may already)
DROP POLICY IF EXISTS "authenticated_sales_order_items_select" ON sales_order_items;
DROP POLICY IF EXISTS "authenticated_sales_order_items_insert" ON sales_order_items;
DROP POLICY IF EXISTS "authenticated_sales_order_items_update" ON sales_order_items;

CREATE POLICY "authenticated_sales_order_items_select" ON sales_order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_sales_order_items_insert" ON sales_order_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_sales_order_items_update" ON sales_order_items
  FOR UPDATE TO authenticated USING (true);

GRANT ALL ON sales_order_items TO authenticated;

-- Optional cleanup: remove duplicate rows accumulated from past failed deletes.
-- This deletes all but the most recently inserted row for each
-- (sales_order_id, product_id, color, size) combination.
DELETE FROM sales_order_items
WHERE id NOT IN (
  SELECT DISTINCT ON (sales_order_id, product_id, color, size) id
  FROM sales_order_items
  ORDER BY sales_order_id, product_id, color, size, id DESC
);

SELECT 'sales_order_items RLS fixed and duplicate rows cleaned up' AS status;
