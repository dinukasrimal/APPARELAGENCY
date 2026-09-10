-- Global active flag on products. Superuser-only toggle; hides a product from
-- every agency's order-creation pickers when false.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

COMMENT ON COLUMN public.products.is_active IS
  'When false, product is hidden from every agency''s order-creation pickers (still visible to superusers in product admin).';

-- Per-agency exclusion: presence of a row means the product is hidden for
-- that agency only, even though it is globally active.
CREATE TABLE IF NOT EXISTS public.agency_product_exclusions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (agency_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_product_exclusions_agency
  ON public.agency_product_exclusions(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_product_exclusions_product
  ON public.agency_product_exclusions(product_id);

ALTER TABLE public.agency_product_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superuser manage agency product exclusions" ON public.agency_product_exclusions;
CREATE POLICY "superuser manage agency product exclusions"
  ON public.agency_product_exclusions FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);

DROP POLICY IF EXISTS "agencies view their own product exclusions" ON public.agency_product_exclusions;
CREATE POLICY "agencies view their own product exclusions"
  ON public.agency_product_exclusions FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role(auth.uid()) = 'superuser'::public.user_role
  );
