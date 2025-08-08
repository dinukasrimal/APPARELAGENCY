import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://ejpwmgluazqcczrpwjlo.supabase.co";

// Get service role key from environment
const getServiceRoleKey = () => {
  // Check for service role key in environment variables
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                    import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey || serviceKey === 'your_service_role_key_here') {
    console.warn('Service role key not configured. Admin user creation will not be available.');
    return null;
  }
  
  return serviceKey;
};

// Create admin client only if service role key is available
const createAdminClient = () => {
  const serviceKey = getServiceRoleKey();
  
  if (!serviceKey) {
    return null;
  }
  
  return createClient<Database>(SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const supabaseAdmin = createAdminClient();

// Helper function to create auth user using admin privileges (minimal version)
export const adminCreateAuthUserMinimal = async (email: string, password: string) => {
  if (!supabaseAdmin) {
    throw new Error('Admin client not available. Service role key not configured.');
  }
  
  console.log('=== MINIMAL AUTH USER CREATION ===');
  console.log('Email:', email);
  console.log('Password length:', password.length);
  
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
    // No user_metadata to avoid database trigger issues
  });
  
  if (error) {
    console.error('Minimal auth user creation error:', error);
    throw error;
  }
  
  return data;
};

// Helper function to create auth user using admin privileges (full version)
export const adminCreateAuthUser = async (email: string, password: string, userData?: any) => {
  if (!supabaseAdmin) {
    throw new Error('Admin client not available. Service role key not configured.');
  }
  
  console.log('=== ADMIN USER CREATION DEBUG ===');
  console.log('Email:', email);
  console.log('Password length:', password.length);
  console.log('User metadata:', userData);
  console.log('Admin client available:', !!supabaseAdmin);
  
  try {
    const createParams = {
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: userData || {}
    };
    
    console.log('Create user parameters:', createParams);
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser(createParams);
    
    console.log('Create user response data:', data);
    console.log('Create user response error:', error);
    
    if (error) {
      console.error('=== AUTH USER CREATION ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error status:', error.status);
      console.error('Error name:', error.name);
      console.error('Full error:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log('=== AUTH USER CREATED SUCCESSFULLY ===');
    console.log('User ID:', data.user?.id);
    console.log('User email:', data.user?.email);
    
    return data;
    
  } catch (err: any) {
    console.error('=== UNEXPECTED ERROR IN AUTH USER CREATION ===');
    console.error('Caught error:', err);
    console.error('Error type:', typeof err);
    console.error('Error constructor:', err.constructor?.name);
    throw err;
  }
};

// Helper function to check if admin operations are available
export const isAdminAvailable = () => {
  return supabaseAdmin !== null;
};