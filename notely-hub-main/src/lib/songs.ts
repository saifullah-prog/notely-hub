import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured, audioUrlFromPath, type Song } from "./supabase";
import { resolveCover } from "./covers";

/** A track as consumed by the UI (cover + audio already resolved to URLs). */
export type Track = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover: string;
  cover_key: string;
  audio_path: string | null;
  audioUrl: string | null;
};

function fallbackTrack(
  title: string,
  artist: string,
  album: string,
  duration: string,
  coverKey: string,
  audioPath: string,
): Track {
  return {
    title,
    artist,
    album,
    duration,
    cover_key: coverKey,
    cover: resolveCover(coverKey),
    audio_path: audioPath,
    audioUrl: audioUrlFromPath(audioPath),
  };
}

/** The songs bundled with the app — used as fallback when Supabase is offline. */
export const fallbackTracks: Track[] = [
  fallbackTrack("Neon Peaks", "Aurora Wave", "Neon Peaks", "3:42", "album1", "aurora-wave/neon-peaks.mp3"),
  fallbackTrack("Midnight Ridge", "Aurora Wave", "Neon Peaks", "4:11", "album1", "aurora-wave/midnight-ridge.mp3"),
  fallbackTrack("Sunset Drive", "Palm Coast", "Sunset Drive", "3:28", "album2", "palm-coast/sunset-drive.mp3"),
  fallbackTrack("Ocean Boulevard", "Palm Coast", "Sunset Drive", "3:55", "album2", "palm-coast/ocean-boulevard.mp3"),
  fallbackTrack("Quiet Hours", "Vera Lune", "Quiet Hours", "4:02", "album3", "vera-lune/quiet-hours.mp3"),
  fallbackTrack("Paper Moon", "Vera Lune", "Quiet Hours", "3:18", "album3", "vera-lune/paper-moon.mp3"),
  fallbackTrack("Cosmic Drift", "Nebula 9", "Cosmic Drift", "5:07", "album4", "nebula-9/cosmic-drift.mp3"),
  fallbackTrack("Event Horizon", "Nebula 9", "Cosmic Drift", "6:22", "album4", "nebula-9/event-horizon.mp3"),
  fallbackTrack("Concrete Kings", "Block Party", "Concrete Kings", "3:12", "album5", "block-party/concrete-kings.mp3"),
  fallbackTrack("Corner Store", "Block Party", "Concrete Kings", "2:58", "album5", "block-party/corner-store.mp3"),
  fallbackTrack("Cotton Sky", "June Bloom", "Cotton Sky", "3:33", "album6", "june-bloom/cotton-sky.mp3"),
  fallbackTrack("Marshmallow Clouds", "June Bloom", "Cotton Sky", "3:47", "album6", "june-bloom/marshmallow-clouds.mp3"),
];

function toTrack(row: Song): Track {
  return {
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    cover_key: row.cover_key,
    cover: resolveCover(row.cover_key),
    audio_path: row.audio_path,
    audioUrl: audioUrlFromPath(row.audio_path),
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
