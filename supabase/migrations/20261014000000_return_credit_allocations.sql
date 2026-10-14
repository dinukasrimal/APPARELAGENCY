-- Returns become credit, and credit is applied to invoices separately.
--
-- A customer hands back goods without knowing which invoice they came from, so
-- a return no longer belongs to an invoice. It carries a value, and that value
-- is applied afterwards: to one invoice, split across several, or left sitting
-- as credit against future ones.

CREATE TABLE IF NOT EXISTS public.return_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_return_credit_alloc_return ON public.return_credit_allocations (return_id);
CREATE INDEX IF NOT EXISTS idx_return_credit_alloc_invoice ON public.return_credit_allocations (invoice_id);

ALTER TABLE public.return_credit_allocations ENABLE ROW LEVEL SECURITY;

-- Mirrors the returns policy: an agency sees and manages its own, head office all.
DROP POLICY IF EXISTS "Agency-based access for return credit" ON public.return_credit_allocations;
CREATE POLICY "Agency-based access for return credit"
  ON public.return_credit_allocations FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.returns r
    WHERE r.id = return_id
      AND (r.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
           OR public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.returns r
    WHERE r.id = return_id
      AND (r.agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
           OR public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  ));

-- A return taken on the grid is priced from the price list and may carry a
-- discount, under the same agency limit that applies to an order.
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS discount_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  -- Set when the discount exceeds the agency's limit: the goods are back in
  -- stock either way, but the credit can't be applied until head office agrees.
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

-- Backfill: every existing invoice link becomes an allocation, so outstanding
-- figures are identical the moment the new code reads allocations instead.
INSERT INTO public.return_credit_allocations (return_id, invoice_id, amount, created_at, created_by)
SELECT r.id, r.invoice_id, LEAST(r.total, i.total), r.created_at, r.created_by
FROM public.returns r
JOIN public.invoices i ON i.id = r.invoice_id
WHERE r.invoice_id IS NOT NULL
  AND r.status::text IN ('approved', 'processed')
  AND r.total > 0
  AND NOT EXISTS (SELECT 1 FROM public.return_credit_allocations a WHERE a.return_id = r.id);

-- Returns with no header link, but whose lines pointed at invoice lines.
INSERT INTO public.return_credit_allocations (return_id, invoice_id, amount, created_at, created_by)
SELECT x.return_id, x.invoice_id, x.amount, x.created_at, x.created_by
FROM (
  SELECT ri.return_id,
         ii.invoice_id,
         LEAST(SUM(ri.total), MIN(i.total)) AS amount,
         MIN(r.created_at) AS created_at,
         (ARRAY_AGG(r.created_by))[1] AS created_by
  FROM public.return_items ri
  JOIN public.invoice_items ii ON ii.id = ri.invoice_item_id
  JOIN public.invoices i ON i.id = ii.invoice_id
  JOIN public.returns r ON r.id = ri.return_id
  WHERE ri.invoice_item_id IS NOT NULL
    AND r.invoice_id IS NULL
    AND r.status::text IN ('approved', 'processed')
    AND NOT EXISTS (SELECT 1 FROM public.return_credit_allocations a WHERE a.return_id = ri.return_id)
  GROUP BY ri.return_id, ii.invoice_id
) x
WHERE x.amount > 0;
