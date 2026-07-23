import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated superuser
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client (key lives only on the Edge Function server)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller's JWT. Extract the raw token and validate it explicitly.
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${authError?.message ?? 'invalid token'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only superusers may create users — look up role with service role (bypasses RLS)
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfile?.role !== 'superuser') {
      return new Response(JSON.stringify({ error: 'Forbidden: superuser role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body — supports these actions:
    //   action: 'create'         → create a new auth user + profile
    //   action: 'reset-link'     → generate a password reset link (no email sent)
    //   action: 'delete-user'    → delete an auth user + profile
    const body = await req.json();
    const action = body.action ?? 'create';

    // ── DELETE USER ───────────────────────────────────────────────────────────
    if (action === 'delete-user') {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent a superuser from deleting their own account
      if (userId === callerUser.id) {
        return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete the profile row first, then the auth user
      await adminClient.from('profiles').delete().eq('id', userId);

      const { error: delError } = await adminClient.auth.admin.deleteUser(userId);
      if (delError) {
        return new Response(JSON.stringify({ error: delError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, userId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GENERATE PASSWORD RESET LINK (bypasses email rate limit) ──────────────
    if (action === 'reset-link') {
      const { email, redirectTo } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: 'email is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: redirectTo ?? `${supabaseUrl.replace('.supabase.co', '')}/reset-password` },
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ link: data.properties?.action_link }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CREATE USER ────────────────────────────────────────────────────────────
    const { email, password, name, role } = body;
    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'email, password and name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Create the auth user (email confirmed, no trigger metadata)
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user!.id;

    // Step 2: Upsert the profile row
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        name,
        email,
        role: role || 'agent',
        agency_id: null,
        agency_name: null,
      }, { onConflict: 'id' });

    if (profileError) {
      // Profile creation failed — roll back the auth user to avoid orphaned accounts
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ userId, email, name, role: role || 'agent' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
