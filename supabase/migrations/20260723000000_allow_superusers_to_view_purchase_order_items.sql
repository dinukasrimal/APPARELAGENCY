-- Keep purchase_order_items visibility aligned with purchase_orders visibility.
-- Superusers can view purchase_orders across agencies, so they also need to view
-- the child rows when opening order details. Without the superuser branch a
-- superuser reads zero purchase_order_items and every order shows "0 items".
DROP POLICY IF EXISTS "Users can view purchase order items for their orders" ON public.purchase_order_items;

CREATE POLICY "Users can view purchase order items for their orders"
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_items.purchase_order_id
      AND (
        purchase_orders.created_by = auth.uid()
        OR purchase_orders.agency_id IN (
          SELECT profiles.agency_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
        )
        OR public.get_user_role(auth.uid()) = 'superuser'::public.user_role
      )
  )
);
