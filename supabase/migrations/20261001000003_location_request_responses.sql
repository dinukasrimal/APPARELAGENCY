-- One row per phone that answers a location check.
--
-- An agent signed in on two handsets gets both woken, and both answers matter:
-- showing only the first makes the map claim a certainty it doesn't have. The
-- parent location_requests row keeps the first answer, so the existing waiting
-- and fallback logic is unchanged; these rows are what the map draws.
CREATE TABLE IF NOT EXISTS public.location_request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.location_requests(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.device_push_tokens(id) ON DELETE SET NULL,
  device_label text,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  error text,
  responded_via text NOT NULL CHECK (responded_via IN ('app', 'background')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A phone answers a given check once; retries must not add pins.
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_response_device
  ON public.location_request_responses (request_id, device_id) WHERE device_id IS NOT NULL;
-- The open app has no device row of its own, and answers once too.
CREATE UNIQUE INDEX IF NOT EXISTS uq_location_response_app
  ON public.location_request_responses (request_id) WHERE device_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_location_responses_request
  ON public.location_request_responses (request_id, created_at);

ALTER TABLE public.location_request_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superuser reads location responses" ON public.location_request_responses;
CREATE POLICY "superuser reads location responses"
  ON public.location_request_responses FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);

-- The agent's own open app files its answer here.
DROP POLICY IF EXISTS "target adds own location response" ON public.location_request_responses;
CREATE POLICY "target adds own location response"
  ON public.location_request_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.location_requests r
    WHERE r.id = request_id AND r.target_user_id = auth.uid()
  ));

-- So the superuser's map can draw each answer as it lands.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'location_request_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_request_responses;
  END IF;
END $$;

-- Which handset a pin came from, so two pins can be told apart.
ALTER TABLE public.device_push_tokens
  ADD COLUMN IF NOT EXISTS device_label text;
