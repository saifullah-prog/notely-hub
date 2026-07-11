import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured } from "./supabase";
import { resolveCover } from "./covers";

/** An album as consumed by the UI (cover resolved to an image URL). */
export type Album = {
  title: string;
  artist: string;
  cover: string;
  cover_key: string;
  tint: string;
};

/** Albums bundled with the app — used as fallback when Supabase is offline. */
export const fallbackAlbums: Album[] = [
  { title: "Neon Peaks", artist: "Aurora Wave", cover_key: "album1", cover: resolveCover("album1"), tint: "from-purple-900" },
  { title: "Sunset Drive", artist: "Palm Coast", cover_key: "album2", cover: resolveCover("album2"), tint: "from-pink-900" },
  { title: "Quiet Hours", artist: "Vera Lune", cover_key: "album3", cover: resolveCover("album3"), tint: "from-slate-800" },
  { title: "Cosmic Drift", artist: "Nebula 9", cover_key: "album4", cover: resolveCover("album4"), tint: "from-indigo-900" },
  { title: "Concrete Kings", artist: "Block Party", cover_key: "album5", cover: resolveCover("album5"), tint: "from-red-900" },
  { title: "Cotton Sky", artist: "June Bloom", cover_key: "album6", cover: resolveCover("album6"), tint: "from-sky-800" },
];

type AlbumRow = { title: string; artist: string; cover_key: string; tint: string | null };

/**
 * Loads all albums from Supabase, falling back to the bundled list when
 * Supabase isn't configured or the request fails.
 */
export function useAlbums() {
  return useQuery({
    queryKey: ["albums"],
    initialData: fallbackAlbums,
    queryFn: async (): Promise<Album[]> => {
      if (!isSupabaseConfigured) return fallbackAlbums;
      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .order("created_at", { ascending: true });
      if (error || !data || data.length === 0) return fallbackAlbums;
      return (data as AlbumRow[]).map((r) => ({
        title: r.title,
        artist: r.artist,
        cover_key: r.cover_key,
        cover: resolveCover(r.cover_key),
        tint: r.tint ?? "from-slate-800",
      }));
    },
  });
}
