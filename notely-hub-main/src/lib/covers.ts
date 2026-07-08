import album1 from "@/assets/album1.jpg";
import album2 from "@/assets/album2.jpg";
import album3 from "@/assets/album3.jpg";
import album4 from "@/assets/album4.jpg";
import album5 from "@/assets/album5.jpg";
import album6 from "@/assets/album6.jpg";

/**
 * Maps a `cover_key` stored in the database to the bundled cover image URL.
 * Keeps artwork working without needing to host images in Supabase Storage yet.
 */
export const coverByKey: Record<string, string> = {
  album1,
  album2,
  album3,
  album4,
  album5,
  album6,
};

/** Resolve a cover_key to an image URL, falling back to the first cover. */
export function resolveCover(key: string | undefined | null): string {
  return (key && coverByKey[key]) || album1;
}
