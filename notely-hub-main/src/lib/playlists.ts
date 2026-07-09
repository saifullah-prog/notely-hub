import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured, type PlaylistRow } from "./supabase";
import { resolveCover } from "./covers";

/** A playlist as consumed by the UI (cover already resolved to an image URL). */
export type Playlist = {
  name: string;
  sub: string;
  cover: string;
  cover_key: string;
  artist: string | null;
};

/** Playlists bundled with the app — used as fallback when Supabase is offline. */
export const fallbackPlaylists: Playlist[] = [
  { name: "Liked Songs", sub: "Playlist • 247 songs", cover_key: "album3", cover: resolveCover("album3"), artist: null },
  { name: "Daily Mix 1", sub: "Aurora Wave, Nebula 9 and more", cover_key: "album1", cover: resolveCover("album1"), artist: null },
  { name: "Discover Weekly", sub: "Your weekly mixtape", cover_key: "album4", cover: resolveCover("album4"), artist: null },
  { name: "Chill Vibes", sub: "Made for you", cover_key: "album6", cover: resolveCover("album6"), artist: null },
  { name: "Late Night Drive", sub: "Palm Coast, Block Party", cover_key: "album2", cover: resolveCover("album2"), artist: null },
  { name: "Underground Hip Hop", sub: "Fresh cuts weekly", cover_key: "album5", cover: resolveCover("album5"), artist: null },
  { name: "Focus Flow", sub: "Deep concentration", cover_key: "album3", cover: resolveCover("album3"), artist: null },
];

function toPlaylist(row: PlaylistRow): Playlist {
  return {
    name: row.name,
    sub: row.sub ?? "",
    cover_key: row.cover_key,
    cover: resolveCover(row.cover_key),
    artist: row.artist,
  };
}

/**
 * Loads all playlists from Supabase (editorial + per-artist), falling back to
 * the bundled list when Supabase isn't configured or the request fails.
 */
export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    initialData: fallbackPlaylists,
    queryFn: async (): Promise<Playlist[]> => {
      if (!isSupabaseConfigured) return fallbackPlaylists;

      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !data || data.length === 0) return fallbackPlaylists;
      return (data as PlaylistRow[]).map(toPlaylist);
    },
  });
}
