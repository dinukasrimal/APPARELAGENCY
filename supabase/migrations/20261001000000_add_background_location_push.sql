-- Waking a closed app to answer a location check.
--
-- The in-app responder only answers while the app is on screen. To reach a
-- closed app we push to the device over FCM, and the phone's native handler
-- answers without the web view ever starting. That handler has no Supabase
-- session, so each request carries a single-use token it can answer with.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios')),
  -- Cleared when FCM tells us the token is dead, so we stop pushing to it.
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user
  ON public.device_push_tokens (user_id) WHERE disabled_at IS NULL;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own device tokens" ON public.device_push_tokens;
CREATE POLICY "own device tokens"
  ON public.device_push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "superuser reads device tokens" ON public.device_push_tokens;
CREATE POLICY "superuser reads device tokens"
  ON public.device_push_tokens FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'superuser'::public.user_role);

-- How a request was answered, and the token that authorises answering it.
ALTER TABLE public.location_requests
  ADD COLUMN IF NOT EXISTS response_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS responded_via text
    CHECK (responded_via IS NULL OR responded_via IN ('app', 'background')),
  -- How many devices the push actually reached; 0 means nothing was woken.
  ADD COLUMN IF NOT EXISTS pushed_to integer NOT NULL DEFAULT 0;

-- Hiding response_token from signed-in roles needs the table-level SELECT grant
-- dropped first, so it lives in the next migration.
