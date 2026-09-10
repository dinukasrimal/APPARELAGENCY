CREATE TABLE IF NOT EXISTS public.inventory_ignored_products (
  product_name text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.inventory_ignored_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can view ignored inventory products" ON public.inventory_ignored_products;
CREATE POLICY "authenticated can view ignored inventory products"
  ON public.inventory_ignored_products FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "superuser manage ignored inventory products" ON public.inventory_ignored_products;
CREATE POLICY "superuser manage ignored inventory products"
  ON public.inventory_ignored_products FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);

COMMENT ON TABLE public.inventory_ignored_products IS
  'product_name values (matching external_inventory_management.product_name) to exclude from all inventory summaries/totals — retired/renamed products whose old transaction history is kept for audit but should no longer surface as phantom stock lines.';

INSERT INTO public.inventory_ignored_products (product_name, reason) VALUES
  ('[BV75] BLACK VEST 75', 'Old product naming, retired — replaced by BLACK VEST SLEEVE LESS/WITH SLEEVE variants'),
  ('[BV80] BLACK VEST 80', 'Old product naming, retired — replaced by BLACK VEST SLEEVE LESS/WITH SLEEVE variants'),
  ('[BV85] BLACK VEST 85', 'Old product naming, retired — replaced by BLACK VEST SLEEVE LESS/WITH SLEEVE variants'),
  ('[BV90] BLACK VEST 90', 'Old product naming, retired — replaced by BLACK VEST SLEEVE LESS/WITH SLEEVE variants'),
  ('[BV95] BLACK VEST 95', 'Old product naming, retired — replaced by BLACK VEST SLEEVE LESS/WITH SLEEVE variants'),
  ('[BV100] BLACK VEST 100', 'Old product naming, retired — replaced by BLACK VEST SLEEVE LESS/WITH SLEEVE variants')
ON CONFLICT (product_name) DO NOTHING;
