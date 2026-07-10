import { useQuery } from "@tanstack/react-query";

import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type RightsKind = "original" | "licensed" | "cover" | "unknown";

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
  rights: RightsKind;
  owns_rights: boolean;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export const COVER_KEYS = ["album1", "album2", "album3", "album4", "album5", "album6"] as const;

export const RIGHTS_LABEL: Record<RightsKind, string> = {
  original: "Original work — I made this",
  licensed: "Licensed — I have permission to distribute",
  cover: "Cover of another artist's song",
  unknown: "Not sure",
};

/** A copyright/moderation warning surfaced to the reviewing admin. */
export type CopyrightFlag = { level: "high" | "medium" | "info"; message: string };

/**
 * Heuristic copyright checks run at review time. Compares the submission against
 * the existing catalog and the creator's own rights declaration. Not a real
 * fingerprint — a safeguard to make the admin aware of likely issues.
 */
export function copyrightFlags(
  s: Pick<Submission, "title" | "artist" | "rights" | "owns_rights">,
  catalog: { title: string; artist: string }[],
): CopyrightFlag[] {
  const flags: CopyrightFlag[] = [];
  const norm = (x: string) => x.trim().toLowerCase();
  const t = norm(s.title);
  const a = norm(s.artist);

  if (!s.owns_rights) {
    flags.push({ level: "high", message: "Creator did NOT confirm they own or have rights to this audio." });
  }
  if (s.rights === "cover") {
    flags.push({ level: "high", message: "Declared as a cover — publishing may need a license from the rights holder." });
  }
  if (s.rights === "licensed") {
    flags.push({ level: "info", message: "Declared as licensed — confirm the license permits distribution here." });
  }
  if (s.rights === "unknown") {
    flags.push({ level: "medium", message: "Creator is unsure of the rights status." });
  }

  const dup = catalog.find((c) => norm(c.title) === t && norm(c.artist) === a);
  if (dup) {
    flags.push({ level: "high", message: `A track "${s.title}" by ${s.artist} already exists in the catalog (possible duplicate).` });
  } else {
    const sameTitle = catalog.find((c) => norm(c.title) === t);
    if (sameTitle) {
      flags.push({ level: "medium", message: `Title matches an existing track by ${sameTitle.artist} — check it isn't a copy.` });
    }
    const sameArtist = catalog.some((c) => norm(c.artist) === a);
    if (sameArtist) {
      flags.push({ level: "medium", message: `Artist name "${s.artist}" matches an existing catalog artist — verify it's really them (impersonation risk).` });
    }
  }

  return flags;
}

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
