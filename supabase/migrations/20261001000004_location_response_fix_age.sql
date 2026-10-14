-- With the screen off and the phone indoors a live fix often never arrives, so
-- the phone answers with its last known position instead. That is useful, but
-- only if head office can see how old it is rather than reading it as "now".
ALTER TABLE public.location_request_responses
  ADD COLUMN IF NOT EXISTS fix_age_seconds integer;
