import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;

function isSupabaseUrlValid(url: string): boolean {
  return Boolean(url && SUPABASE_URL_PATTERN.test(url));
}

/**
 * Call before using Supabase (e.g. upload). Throws if URL is missing or invalid
 * so the UI can show a clear error instead of a generic network failure.
 */
export function ensureSupabaseConfig(): void {
  if (!supabaseUrl) {
    throw new Error(
      'REACT_APP_SUPABASE_URL is missing. Set it in .env to your Supabase project URL (e.g. https://xxx.supabase.co).'
    );
  }
  if (!isSupabaseUrlValid(supabaseUrl)) {
    throw new Error(
      `REACT_APP_SUPABASE_URL is invalid: "${supabaseUrl}". It must be a valid https://*.supabase.co URL.`
    );
  }
  if (!supabaseAnonKey) {
    throw new Error(
      'REACT_APP_SUPABASE_ANON_KEY is missing. Set it in .env from Supabase Dashboard → Settings → API.'
    );
  }
}

/** Expose current URL for error messages (no secret). */
export function getSupabaseUrl(): string {
  return supabaseUrl || '(not set)';
}

// Log once in dev so we can confirm which project is used
if (typeof window !== 'undefined') {
  const isDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (isDev) {
    if (isSupabaseUrlValid(supabaseUrl)) {
      console.info('[LetsRevise] Supabase URL (dev):', supabaseUrl);
    } else {
      console.warn(
        '[LetsRevise] Supabase URL missing or invalid. Uploads will fail until REACT_APP_SUPABASE_URL is set to https://xxx.supabase.co'
      );
    }
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || ''
);
