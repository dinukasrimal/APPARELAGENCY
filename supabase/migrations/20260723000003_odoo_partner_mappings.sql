-- Explicit mapping between an Odoo partner_name and an agency, so the external
-- invoice sync no longer relies on fragile exact name matching. One partner maps
-- to exactly one agency.
CREATE TABLE IF NOT EXISTS public.odoo_partner_mappings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  agency_id    uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  agency_name  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

-- One partner_name can only map to one agency (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS odoo_partner_mappings_partner_lower_key
  ON public.odoo_partner_mappings (lower(trim(partner_name)));

ALTER TABLE public.odoo_partner_mappings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may READ the mappings (the sync reads them).
DROP POLICY IF EXISTS "read odoo partner mappings" ON public.odoo_partner_mappings;
CREATE POLICY "read odoo partner mappings"
  ON public.odoo_partner_mappings FOR SELECT TO authenticated USING (true);

-- Only superusers may create / update / delete mappings.
DROP POLICY IF EXISTS "superuser manage odoo partner mappings" ON public.odoo_partner_mappings;
CREATE POLICY "superuser manage odoo partner mappings"
  ON public.odoo_partner_mappings FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);
