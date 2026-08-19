import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const SUPABASE_STORAGE_KEY = "bakery-erp-supabase-session";

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_STORAGE_KEY,
        // Mobile Chrome can retain a stale navigator lock after a tab is suspended.
        // The login proxy already serializes credential exchange server-side, so
        // bypass the browser lock to prevent setSession from hanging indefinitely.
        lock: async (_name, _acquireTimeout, callback) => callback(),
      },
    })
  : null;

export function persistSupabaseSessionFallback(session: {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
  user?: unknown;
}) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type ?? "bearer",
    expires_in: session.expires_in ?? 3600,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    user: session.user ?? null,
  }));
}
