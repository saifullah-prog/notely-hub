import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured, type Song } from "./supabase";
import { resolveCover } from "./covers";

/** A track as consumed by the UI (cover already resolved to an image URL). */
export type Track = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover: string;
  cover_key: string;
};

/** The songs bundled with the app — used as fallback when Supabase is offline. */
export const fallbackTracks: Track[] = [
  { title: "Neon Peaks", artist: "Aurora Wave", album: "Neon Peaks", duration: "3:42", cover_key: "album1", cover: resolveCover("album1") },
  { title: "Midnight Ridge", artist: "Aurora Wave", album: "Neon Peaks", duration: "4:11", cover_key: "album1", cover: resolveCover("album1") },
  { title: "Sunset Drive", artist: "Palm Coast", album: "Sunset Drive", duration: "3:28", cover_key: "album2", cover: resolveCover("album2") },
  { title: "Ocean Boulevard", artist: "Palm Coast", album: "Sunset Drive", duration: "3:55", cover_key: "album2", cover: resolveCover("album2") },
  { title: "Quiet Hours", artist: "Vera Lune", album: "Quiet Hours", duration: "4:02", cover_key: "album3", cover: resolveCover("album3") },
  { title: "Paper Moon", artist: "Vera Lune", album: "Quiet Hours", duration: "3:18", cover_key: "album3", cover: resolveCover("album3") },
  { title: "Cosmic Drift", artist: "Nebula 9", album: "Cosmic Drift", duration: "5:07", cover_key: "album4", cover: resolveCover("album4") },
  { title: "Event Horizon", artist: "Nebula 9", album: "Cosmic Drift", duration: "6:22", cover_key: "album4", cover: resolveCover("album4") },
  { title: "Concrete Kings", artist: "Block Party", album: "Concrete Kings", duration: "3:12", cover_key: "album5", cover: resolveCover("album5") },
  { title: "Corner Store", artist: "Block Party", album: "Concrete Kings", duration: "2:58", cover_key: "album5", cover: resolveCover("album5") },
  { title: "Cotton Sky", artist: "June Bloom", album: "Cotton Sky", duration: "3:33", cover_key: "album6", cover: resolveCover("album6") },
  { title: "Marshmallow Clouds", artist: "June Bloom", album: "Cotton Sky", duration: "3:47", cover_key: "album6", cover: resolveCover("album6") },
];

function toTrack(row: Song): Track {
  return {
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    cover_key: row.cover_key,
    cover: resolveCover(row.cover_key),
  };
}

/**
 * Loads the song catalog from Supabase, falling back to the bundled list when
 * Supabase isn't configured or the request fails — so the UI always has data.
 */
export function useSongs() {
  return useQuery({
    queryKey: ["songs"],
    initialData: fallbackTracks,
    queryFn: async (): Promise<Track[]> => {
      if (!isSupabaseConfigured) return fallbackTracks;

      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !data || data.length === 0) return fallbackTracks;
      return (data as Song[]).map(toTrack);
    },
  });
}
