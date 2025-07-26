// External Supabase client for connecting to your other project
import { createClient } from '@supabase/supabase-js';

// External project configuration
// Environment variables for external Supabase project
const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || process.env.NEXT_PUBLIC_EXTERNAL_SUPABASE_URL || 'https://your-other-project.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_EXTERNAL_SUPABASE_ANON_KEY || 'your-other-project-anon-key';

// Debug logging for browser environment
console.log('🔧 External Supabase Client Configuration:');
console.log('  URL from import.meta.env:', import.meta.env.VITE_EXTERNAL_SUPABASE_URL);
console.log('  URL from process.env:', process.env.NEXT_PUBLIC_EXTERNAL_SUPABASE_URL);
console.log('  Final URL:', EXTERNAL_SUPABASE_URL);
console.log('  Key available:', EXTERNAL_SUPABASE_ANON_KEY ? '✅ Yes' : '❌ No');
console.log('  Key length:', EXTERNAL_SUPABASE_ANON_KEY ? EXTERNAL_SUPABASE_ANON_KEY.length : 0);

// Define the external database schema types
export interface ExternalDatabase {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string;
          name: string | null;
          partner_name: string;
          date_order: string; // Date as string from database
          amount_total: number;
          state: string | null;
          order_lines: any; // JSON field
        };
        Insert: {
          id?: string;
          name?: string | null;
          partner_name: string;
          date_order: string;
          amount_total: number;
          state?: string | null;
          order_lines?: any;
        };
        Update: {
          id?: string;
          name?: string | null;
          partner_name?: string;
          date_order?: string;
          amount_total?: number;
          state?: string | null;
          order_lines?: any;
        };
      };
      sales_targets: {
        Row: {
          id: string;
          customer_name: string;
          target_year: number;
          target_months: string | string[]; // Can be string or array from database
          base: number | null;
          year: number | null;
          target: any | null; // JSON field
          data: any | null; // JSON field
          initial_total_value: number;
          adjusted_total_value: number;
          percentage_increase: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          customer_name: string;
          target_year: number;
          target_months: string | string[];
          base?: number | null;
          year?: number | null;
          target?: any | null;
          data?: any | null;
          initial_total_value?: number;
          adjusted_total_value?: number;
          percentage_increase?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          customer_name?: string;
          target_year?: number;
          target_months?: string | string[];
          base?: number | null;
          year?: number | null;
          target?: any | null;
          data?: any | null;
          initial_total_value?: number;
          adjusted_total_value?: number;
          percentage_increase?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
    };
  };
}

// Create the external Supabase client
export const externalSupabase = createClient<ExternalDatabase>(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false // Don't persist auth session for external client
    }
  }
);

// Utility function to check if external client is properly configured
export const isExternalClientConfigured = (): boolean => {
  const urlCheck = EXTERNAL_SUPABASE_URL !== 'https://your-other-project.supabase.co';
  const keyCheck = EXTERNAL_SUPABASE_ANON_KEY !== 'your-other-project-anon-key';
  const validUrlCheck = EXTERNAL_SUPABASE_URL.includes('supabase.co');
  
  console.log('🔍 External Client Configuration Check:');
  console.log('  URL not placeholder:', urlCheck, `(${EXTERNAL_SUPABASE_URL})`);
  console.log('  Key not placeholder:', keyCheck, `(${EXTERNAL_SUPABASE_ANON_KEY ? 'Set' : 'Not set'})`);
  console.log('  Valid URL format:', validUrlCheck);
  
  const isConfigured = urlCheck && keyCheck && validUrlCheck;
  console.log('  Final result:', isConfigured ? '✅ Configured' : '❌ Not configured');
  
  return isConfigured;
};

// Test connection to external database
export const testExternalConnection = async (): Promise<{success: boolean, error?: string}> => {
  try {
    if (!isExternalClientConfigured()) {
      return {
        success: false,
        error: 'External Supabase client not configured. Please set environment variables.'
      };
    }

    // Try a simple query to test connection
    const { data, error } = await externalSupabase
      .from('sales_targets')
      .select('count(*)')
      .limit(1);

    if (error) {
      return {
        success: false,
        error: `Connection test failed: ${error.message}`
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};