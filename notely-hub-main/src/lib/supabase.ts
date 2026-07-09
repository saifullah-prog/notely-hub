import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the Rocky app.
 *
 * Reads credentials from Vite env vars (exposed to the client because they are
 * prefixed with VITE_). Copy `.env.example` to `.env` and fill these in with the
 * values from your Supabase project → Settings → API.
 */
// Trim so a stray space/newline pasted into a hosting provider's env var
// (a common cause of "Invalid API key") can't corrupt the credentials.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

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
  audio_path: string | null;
  created_at: string;
};

/**
 * Resolves a storage path in the public `audio` bucket to a playable URL.
 * Returns null when there's no path or Supabase isn't configured.
 */
export function audioUrlFromPath(path: string | null | undefined): string | null {
  if (!path || !isSupabaseConfigured) return null;
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  return data.publicUrl || null;
}

/** Shape of a row in the public.playlists table. */
export type PlaylistRow = {
  id: string;
  name: string;
  sub: string | null;
  cover_key: string;
  artist: string | null;
  created_at: string;
};
