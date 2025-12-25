import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// Helper to safely retrieve environment variables from process.env or import.meta.env
const getEnvVar = (key: string, viteKey: string): string => {
  let value = '';
  
  // Try process.env (Node/System)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      value = process.env[key]!;
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }

  // Try import.meta.env (Vite) if value is still empty
  if (!value) {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
        // @ts-ignore
        value = import.meta.env[viteKey];
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return value;
};

// Use fallbacks to prevent the "supabaseUrl is required" error which crashes the app
const supabaseUrl = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL') || 'https://placeholder.supabase.co';
const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || 'placeholder-key';

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn("Supabase URL is missing! Authentication and database features will not work properly.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
export const SUPABASE_CONFIGURED = supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey !== 'placeholder-key';
