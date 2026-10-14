-- A phone that hasn't opened the app in months is usually a spare in a drawer,
-- or one that has changed hands. Waking it answers a location check with a
-- place the agent isn't, so track freshness and stop pushing to stale devices.
ALTER TABLE public.device_push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_fresh
  ON public.device_push_tokens (user_id, last_seen_at DESC) WHERE disabled_at IS NULL;
