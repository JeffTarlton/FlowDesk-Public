import { createClient } from '@supabase/supabase-js';

// Documented names are VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (see docs/SETUP.md).
// The NEXT_PUBLIC_* names are what the Vercel <-> Supabase integration injects; vite.config.ts
// exposes that prefix. The key may be a legacy anon key or a new publishable key.
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const rawKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  ''
).trim();

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

export const supabaseEnvStatus: { url: 'ok' | 'missing' | 'invalid'; key: 'ok' | 'missing' } = {
  url: !rawUrl ? 'missing' : isHttpUrl(rawUrl) ? 'ok' : 'invalid',
  key: rawKey ? 'ok' : 'missing',
};

export const isSupabaseConfigured = supabaseEnvStatus.url === 'ok' && supabaseEnvStatus.key === 'ok';

// Resolved project URL (no trailing slash), e.g. for direct Edge Function calls.
// Falls back to a placeholder so createClient() never throws; the app shows a setup screen instead.
export const supabaseUrl = isSupabaseConfigured ? rawUrl.replace(/\/+$/, '') : 'https://placeholder.supabase.co';

if (!isSupabaseConfigured) {
  console.error("Missing Supabase Environment Variables: Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see docs/SETUP.md).");
}

export const supabase = createClient(
  supabaseUrl,
  isSupabaseConfigured ? rawKey : 'placeholder',
  {
    global: {
      fetch: async (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          return await fetch(url, { ...options, signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
      }
    },
    auth: {
      // Automatically refresh the session when the browser tab regains focus.
      // This is critical for preventing stale tokens after the user tabs away.
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    realtime: {
      params: {
        // Send a heartbeat every 15s so the server knows we're alive
        heartbeat_interval_ms: 15_000,
      },
      // If the WebSocket drops, reconnect after 1s and back off to max 10s
      reconnectAfterMs: (tries: number) =>
        [1_000, 2_000, 5_000, 10_000][Math.min(tries - 1, 3)],
      // Close socket if no pong received within 30s
      timeout: 30_000,
    },
  }
);
