import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Mobile Chrome can retain a stale navigator lock after a tab is suspended.
        // The login proxy already serializes credential exchange server-side, so
        // bypass the browser lock to prevent setSession from hanging indefinitely.
        lock: async (_name, _acquireTimeout, callback) => callback(),
      },
    })
  : null;
