// Asks one agent's phone where it is, right now.
//
// Creates the location_requests row, then pushes a high-priority FCM data
// message to every device that agent has registered. A data message (no
// notification payload) is what lets the phone's native handler run while the
// app is closed, without showing anything to the agent beyond the brief
// "sharing location" notice its foreground service posts.
//
// The agent's app, if it happens to be open, answers over Realtime instead —
// whichever gets there first wins, and the second update is a no-op.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// The Firebase service-account JSON, pasted whole into a Supabase secret.
const FCM_SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '';

// A phone that hasn't opened the app in this long is treated as gone.
const STALE_DEVICE_MS = 30 * 24 * 60 * 60 * 1000;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const pemToPkcs8 = (pem: string): Uint8Array => {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

// Google wants an OAuth2 access token, and gives one in exchange for a JWT
// signed with the service account's key. Cached for the life of the instance.
let cachedToken: { value: string; expiresAt: number } | null = null;

const getAccessToken = async (account: ServiceAccount): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const unsigned = `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(claims)))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const assertion = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);

  const body = await res.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Not signed in' }, 401);

    // Who is asking — and are they allowed to ask?
    const caller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: 'Not signed in' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'superuser') return json({ error: 'Only head office can run a location check' }, 403);

    const { target_user_id } = await req.json();
    if (!target_user_id) return json({ error: 'Missing target_user_id' }, 400);

    const { data: request, error: insertError } = await admin
      .from('location_requests')
      .insert({ target_user_id, requested_by: user.id })
      .select('id, response_token')
      .single();
    if (insertError || !request) return json({ error: insertError?.message ?? 'Could not create the request' }, 500);

    // No Firebase configured yet: the request still stands, and an open app
    // will answer it over Realtime exactly as before.
    if (!FCM_SERVICE_ACCOUNT) {
      return json({ request_id: request.id, pushed_to: 0, note: 'Push not configured; only an open app can answer.' });
    }

    // Only phones that have opened the app recently. An old handset still
    // holding a registration would answer from wherever it is sitting, and the
    // map would label that as the agent — worse than not answering at all.
    const staleBefore = new Date(Date.now() - STALE_DEVICE_MS).toISOString();
    const { data: devices } = await admin
      .from('device_push_tokens')
      .select('id, token, device_label')
      .eq('user_id', target_user_id)
      .is('disabled_at', null)
      .gte('last_seen_at', staleBefore);

    if (!devices?.length) {
      return json({ request_id: request.id, pushed_to: 0, note: 'That agent has no phone signed in recently.' });
    }

    const account: ServiceAccount = JSON.parse(FCM_SERVICE_ACCOUNT);
    const accessToken = await getAccessToken(account);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;

    let delivered = 0;
    await Promise.all(devices.map(async (device) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: device.token,
            // Data-only: no notification block, or Android hands it to the
            // system tray and never calls our handler while the app is closed.
            data: {
              type: 'locate',
              request_id: request.id,
              response_token: request.response_token,
              // Comes back with the answer, so two phones produce two
              // distinguishable pins rather than one overwriting the other.
              device_id: device.id,
            },
            android: { priority: 'HIGH' },
          },
        }),
      });

      if (res.ok) { delivered++; return; }

      // 404/403 mean the app was uninstalled or the token rotated: stop using it.
      if (res.status === 404 || res.status === 403) {
        await admin.from('device_push_tokens').update({ disabled_at: new Date().toISOString() }).eq('id', device.id);
      }
      console.error('FCM send failed', res.status, await res.text());
    }));

    await admin.from('location_requests').update({ pushed_to: delivered }).eq('id', request.id);

    return json({ request_id: request.id, pushed_to: delivered });
  } catch (error) {
    console.error('request-location failed', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
