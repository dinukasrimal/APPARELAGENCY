-- Keep sales_order_items visibility aligned with sales_orders visibility.
-- Superusers can view sales_orders across agencies, so they also need to view
-- the child rows when opening order details.
DROP POLICY IF EXISTS "Users can view sales order items for their orders" ON public.sales_order_items;

CREATE POLICY "Users can view sales order items for their orders"
ON public.sales_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_orders
    WHERE sales_orders.id = sales_order_items.sales_order_id
      AND (
        sales_orders.created_by = auth.uid()
        OR sales_orders.agency_id IN (
          SELECT profiles.agency_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
        )
        OR public.get_user_role(auth.uid()) = 'superuser'::public.user_role
      )
  )
);
