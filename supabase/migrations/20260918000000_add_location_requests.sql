-- On-demand location checks: a superuser asks, the agent's open app answers
-- once with a single GPS fix. Nothing is tracked continuously.
CREATE TABLE IF NOT EXISTS public.location_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'failed', 'expired')),
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_location_requests_target_pending
  ON public.location_requests (target_user_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superuser manage location requests" ON public.location_requests;
CREATE POLICY "superuser manage location requests"
  ON public.location_requests FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);

-- The agent can see requests aimed at them (needed to receive them in
-- realtime) and answer them — but only their own.
DROP POLICY IF EXISTS "target sees own location requests" ON public.location_requests;
CREATE POLICY "target sees own location requests"
  ON public.location_requests FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

DROP POLICY IF EXISTS "target answers own location requests" ON public.location_requests;
CREATE POLICY "target answers own location requests"
  ON public.location_requests FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (target_user_id = auth.uid());

-- Deliver inserts/updates over Supabase Realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'location_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_requests;
  END IF;
END $$;
