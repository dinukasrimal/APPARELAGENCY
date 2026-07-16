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

async function callCreateUserEdgeFunction(
  email: string,
  password: string,
  name: string,
  role: string
): Promise<{ user: { id: string; email: string } }> {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { email, password, name, role },
  });

  if (error) {
    throw new Error(error.message ?? 'Edge Function error');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return { user: { id: data.userId, email: data.email } };
}

// Always available now — Edge Function handles auth
export const isAdminAvailable = () => true;

// No longer needed — kept for import compatibility
export const supabaseAdmin = null;
