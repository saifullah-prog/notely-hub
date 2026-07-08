import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the Rocky app.
 *
 * Reads credentials from Vite env vars (exposed to the client because they are
 * prefixed with VITE_). Copy `.env.example` to `.env` and fill these in with the
 * values from your Supabase project → Settings → API.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars are present, so UI can degrade gracefully. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Auth and remote song data are disabled — see .env.example.",
  );
}

/**
 * A single shared client. When env vars are missing we still construct a client
 * against harmless placeholders so imports never crash during SSR/build; any
 * real network call simply fails and callers fall back to local data.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? "http://localhost:54321",
  supabaseAnonKey ?? "public-anon-key-not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** Shape of a row in the public.songs table. */
export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover_key: string;
  created_at: string;
};
