// The answer from a phone whose app was closed.
//
// The native handler that took the GPS fix has no Supabase session, so it
// proves itself with the single-use response_token that came down in the push.
// A token is only good for its own request, only while that request is still
// pending, and only for two minutes — after that the superuser's screen has
// already given up and fallen back to the last known location.
//
// The phone authenticates to the gateway with the public anon key, like any
// unauthenticated caller; what actually authorises the write is the token.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_REQUEST_AGE_MS = 2 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { request_id, response_token, device_id, latitude, longitude, accuracy, fix_age_seconds, error: deviceError } = await req.json();
    if (!request_id || !response_token) return json({ error: 'Missing request_id or response_token' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: request } = await admin
      .from('location_requests')
      .select('id, status, created_at, response_token')
      .eq('id', request_id)
      .single();

    if (!request || request.response_token !== response_token) return json({ error: 'Unknown request' }, 403);
    if (Date.now() - new Date(request.created_at).getTime() > MAX_REQUEST_AGE_MS) {
      await admin.from('location_requests').update({ status: 'expired' }).eq('id', request_id).eq('status', 'pending');
      return json({ ok: false, note: 'Too late' });
    }

    const located = !deviceError && latitude != null && longitude != null;

    // Which handset this is, so the map can label its pin.
    let deviceLabel: string | null = null;
    if (device_id) {
      const { data: device } = await admin
        .from('device_push_tokens')
        .select('device_label')
        .eq('id', device_id)
        .maybeSingle();
      deviceLabel = device?.device_label ?? null;
    }

    // Every phone that answers gets a row — a second one is an extra pin, not
    // a rejected duplicate. A plain insert, because the uniqueness that stops a
    // phone pinning itself twice is a *partial* index, and Postgres cannot infer
    // ON CONFLICT from one: a 23505 here simply means this phone already answered.
    const { error: responseError } = await admin
      .from('location_request_responses')
      .insert({
        request_id,
        device_id: device_id ?? null,
        device_label: deviceLabel,
        latitude: located ? Number(latitude) : null,
        longitude: located ? Number(longitude) : null,
        accuracy: located && accuracy != null ? Number(accuracy) : null,
        fix_age_seconds: located && fix_age_seconds != null ? Math.round(Number(fix_age_seconds)) : null,
        error: located ? null : String(deviceError ?? 'No GPS fix'),
        responded_via: 'background',
      });

    if (responseError && responseError.code !== '23505') {
      console.error('Could not record the response', responseError.message);
      return json({ error: responseError.message }, 500);
    }

    // The parent row still holds the first answer, which is what the waiting
    // and last-known fallback are built on.
    if (request.status === 'pending') {
      const answered = located
        ? { status: 'fulfilled', latitude: Number(latitude), longitude: Number(longitude), accuracy: accuracy == null ? null : Number(accuracy) }
        : { status: 'failed', error: String(deviceError ?? 'No GPS fix') };

      await admin
        .from('location_requests')
        .update({ ...answered, responded_via: 'background', responded_at: new Date().toISOString() })
        .eq('id', request_id)
        .eq('status', 'pending');
    }

    return json({ ok: true });
  } catch (error) {
    console.error('submit-location failed', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
