import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type Submission = {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  cover_key: string;
  audio_path: string | null;
  status: SubmissionStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export const COVER_KEYS = ["album1", "album2", "album3", "album4", "album5", "album6"] as const;

/** The current user's own submissions (newest first). */
export function useMySubmissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-submissions", user?.id],
    enabled: Boolean(user) && isSupabaseConfigured,
    queryFn: async (): Promise<Submission[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });
}

/** All submissions (admins only, via RLS) — used by the review queue. */
export function useAllSubmissions(enabled: boolean) {
  return useQuery({
    queryKey: ["submissions"],
    enabled: enabled && isSupabaseConfigured,
    queryFn: async (): Promise<Submission[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });
}

/** Read an audio Blob/File's duration and format it as m:ss (best effort). */
export function readAudioDuration(src: Blob | string): Promise<string> {
  return new Promise((resolve) => {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (secs: number) => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      if (!Number.isFinite(secs) || secs <= 0) return resolve("");
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      resolve(`${m}:${s.toString().padStart(2, "0")}`);
    };
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}
