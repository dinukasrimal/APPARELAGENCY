-- A column-level REVOKE does nothing while the role still holds SELECT on the
-- whole table, so drop that and grant the columns explicitly instead. The
-- response token is the credential a closed phone answers a check with;
-- nothing that signs in needs to read it.
REVOKE SELECT ON public.location_requests FROM authenticated;
GRANT SELECT (
  id, target_user_id, requested_by, status, latitude, longitude, accuracy,
  error, created_at, responded_at, responded_via, pushed_to
) ON public.location_requests TO authenticated;
