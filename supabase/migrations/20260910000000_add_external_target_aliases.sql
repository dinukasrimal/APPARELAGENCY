CREATE TABLE IF NOT EXISTS public.external_target_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_name text NOT NULL,
  external_customer_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_target_aliases_local_name
  ON public.external_target_aliases (lower(btrim(local_name)));

ALTER TABLE public.external_target_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can view external target aliases" ON public.external_target_aliases;
CREATE POLICY "authenticated can view external target aliases"
  ON public.external_target_aliases FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "superuser manage external target aliases" ON public.external_target_aliases;
CREATE POLICY "superuser manage external target aliases"
  ON public.external_target_aliases FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);

COMMENT ON TABLE public.external_target_aliases IS
  'Maps a local agency name to the customer_name that agency''s targets are filed under in the external sales_targets project, for cases the fuzzy name matcher cannot bridge (e.g. IMAS AGENCY -> MR.IMAS).';

INSERT INTO public.external_target_aliases (local_name, external_customer_name, notes) VALUES
  ('IMAS AGENCY', 'MR.IMAS', 'External targets are filed under MR.IMAS; fuzzy matching cannot bridge the dot-joined name.')
ON CONFLICT DO NOTHING;
