import { supabase } from './client';

// User creation is handled by the create-user Edge Function.
// The service role key lives only on the Edge Function server — never in the browser bundle.

export interface CreateUserResult {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function adminCreateAuthUserMinimal(
  email: string,
  password: string
): Promise<{ user: { id: string; email: string } }> {
  return callCreateUserEdgeFunction(email, password, '', 'agent');
}

export async function adminCreateAuthUser(
  email: string,
  password: string,
  userData?: { name?: string; role?: string }
): Promise<{ user: { id: string; email: string } }> {
  return callCreateUserEdgeFunction(
    email,
    password,
    userData?.name ?? '',
    userData?.role ?? 'agent'
  );
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Not signed in — please log out and log back in.');
  }
  return { Authorization: `Bearer ${token}` };
}

async function callCreateUserEdgeFunction(
  email: string,
  password: string,
  name: string,
  role: string
): Promise<{ user: { id: string; email: string } }> {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { action: 'create', email, password, name, role },
    headers,
  });

  if (error) {
    // Extract the real error body from the Edge Function response
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) throw new Error(body.error);
    } catch (parseErr: any) {
      if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
    }
    throw new Error(error.message ?? 'Edge Function error');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return { user: { id: data.userId, email: data.email } };
}

export async function adminGeneratePasswordResetLink(email: string): Promise<string> {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      action: 'reset-link',
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    },
    headers,
  });

  if (error) {
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) throw new Error(body.error);
    } catch (parseErr: any) {
      if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
    }
    throw new Error(error.message ?? 'Edge Function error');
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.link) throw new Error('No reset link returned');

  return data.link as string;
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { action: 'delete-user', userId },
    headers,
  });

  if (error) {
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) throw new Error(body.error);
    } catch (parseErr: any) {
      if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
    }
    throw new Error(error.message ?? 'Edge Function error');
  }
  if (data?.error) throw new Error(data.error);
}

// Always available now — Edge Function handles auth
export const isAdminAvailable = () => true;

// No longer needed — kept for import compatibility
export const supabaseAdmin = null;
