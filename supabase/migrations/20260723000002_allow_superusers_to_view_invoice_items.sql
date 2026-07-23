-- Keep invoice_items visibility aligned with invoices visibility.
-- Superusers can view invoices across agencies, so they also need to view the
-- child line items — otherwise anything that reads invoice_items (the category
-- achievement breakdown, delivery details, etc.) silently gets zero rows for a
-- superuser, even though the parent invoice is visible.
DROP POLICY IF EXISTS "Users can view invoice items for their invoices" ON public.invoice_items;

CREATE POLICY "Users can view invoice items for their invoices"
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND (
        invoices.created_by = auth.uid()
        OR invoices.agency_id IN (
          SELECT profiles.agency_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
        )
        OR public.get_user_role(auth.uid()) = 'superuser'::public.user_role
      )
  )
);
