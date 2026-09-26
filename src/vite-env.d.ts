/// <reference types="vite/client" />

// Build-time environment variables (see .env.example and docs/SETUP.md).
// Only VITE_* and NEXT_PUBLIC_* names are exposed to the browser (envPrefix in vite.config.ts).
interface ImportMetaEnv {
  // Supabase project URL + public key (legacy anon key or new publishable key)
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;

  // Names set by the Vercel <-> Supabase integration (accepted as fallbacks)
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;

  // Optional FullCalendar Premium license key for the Calendar "Timeline" view
  readonly VITE_FULLCALENDAR_LICENSE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
