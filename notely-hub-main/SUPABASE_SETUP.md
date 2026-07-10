# Supabase setup (login + song database)

This app now has email/password login and loads its song catalog from Supabase.

## 1. Install the new dependency

```bash
bun install
```

(This pulls in `@supabase/supabase-js`, which was added to `package.json`.)

## 2. Create a Supabase project

1. Go to https://supabase.com and create a project (free tier is fine).
2. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 3. Add credentials

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> The anon key is safe to expose in the browser — the tables are protected by
> Row Level Security. Never put the `service_role` key in this file.

## 4. Create the tables and seed the songs

Open **SQL Editor** in the Supabase dashboard, paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and
click **Run**. This creates the `songs`, `albums`, `artists`, and `playlists`
tables, enables public-read RLS, and inserts every song the app ships with.

Then run the other migrations the same way (SQL Editor → paste → Run):
- [`0002_artist_playlists.sql`](supabase/migrations/0002_artist_playlists.sql) — per-artist playlists.
- [`0003_audio_storage.sql`](supabase/migrations/0003_audio_storage.sql) — audio playback (adds `audio_path`, creates the public `audio` storage bucket + policies, and sets each song's path).

(Or, with the Supabase CLI linked to your project: `supabase db push`.)

## 4b. Upload audio so songs actually play

Playback streams MP3s from the `audio` storage bucket (created by migration
`0003`). Each song has an `audio_path` like `aurora-wave/neon-peaks.mp3`. Upload
one MP3 per song at that exact path:

1. Supabase dashboard → **Storage → `audio` bucket**.
2. Create folders and upload files matching the paths, e.g.
   `aurora-wave/neon-peaks.mp3`, `palm-coast/sunset-drive.mp3`, … (the full list
   is in [`0003_audio_storage.sql`](supabase/migrations/0003_audio_storage.sql)).
3. That's it — the player builds the public URL from `audio_path` automatically.

Until a file is uploaded, that track shows "No audio uploaded yet" in the
now-playing panel and the play button does nothing for it (everything else still
works). To point a song at a different file, just change its `audio_path`.

## 5. Run the app

```bash
bun dev
```

- Visit `/login` to sign up / log in.
- The home page reads songs from the `songs` table. If Supabase isn't
  configured or is unreachable, it automatically falls back to the bundled song
  list, so the UI never breaks.

## 6. Admin portal

The app has an admin portal at **`/admin`** for adding songs, managing users, and
your account (change email / password).

**Set it up:**
1. Run migration [`0004_admin.sql`](supabase/migrations/0004_admin.sql) (SQL Editor
   → paste → Run). It creates a `profiles` table, an auto-profile trigger, and
   **admin-only write policies** on the catalog.
2. **Sign up in the app first** with the email you want to be admin (so a profile
   row exists), then edit the last line of `0004_admin.sql` (or run it directly):
   ```sql
   update public.profiles set is_admin = true where email = 'YOUR-EMAIL';
   ```
3. Reload the app — an **Admin** button appears in the top bar for admins, linking
   to `/admin`.

**Security model (protection against tampering):**
- Authorization is enforced by **Row Level Security in the database**, not just the
  UI. Only users with `is_admin = true` can INSERT/UPDATE/DELETE songs, playlists,
  albums, artists, or change other users' roles. A modified/hostile client still
  can't write — Postgres rejects it.
- `public.is_admin()` is a `SECURITY DEFINER` function, so policies check admin
  status without recursion and **without ever exposing the `service_role` key**.
- The `/admin` route also guards on the client (redirects non-users to `/login`,
  shows "Not authorized" for non-admins) as a convenience layer.
- Inputs are validated with `zod`; React escapes output (no XSS via song fields).
- Fully deleting/banning auth users needs the `service_role` key + a server
  function and is intentionally **not** done from the browser.

## 7. Creator studio (user uploads → admin approval)

Any signed-in user can open **Creator Studio** (the **Studio** button in the top
bar, or from their profile) to record audio in the browser or upload a file, add
details, and **submit a track for publishing**. Each submission lands in the
**admin portal → Submissions** tab (with a pending-count badge); an admin plays
it and **Approve & publish** (adds it to the public catalog) or **Reject**.

**Set it up:** run migration [`0006_submissions.sql`](supabase/migrations/0006_submissions.sql)
(SQL Editor → paste → Run). It creates a `submissions` table with RLS so users
only see/insert their own submissions while admins can review all of them.

- Audio files upload to the existing public `audio` bucket under
  `submissions/<user_id>/…` (uses the authenticated-write policy from migration
  0003), so no extra storage setup is needed.
- In-browser recordings are WebM/Opus (works in Chromium/Firefox); users can also
  upload MP3/other files. Recording requires HTTPS (or localhost).

**Copyright awareness** (migration [`0007_submission_rights.sql`](supabase/migrations/0007_submission_rights.sql)):
creators must declare rights (original / licensed / cover / unsure) and tick an
ownership confirmation before submitting. The admin's review shows this
declaration plus automatic heuristic flags — missing attestation, declared
covers, duplicate title/artist, artist-name collisions (impersonation risk) —
and asks for confirmation before publishing anything with a HIGH flag. This is a
lightweight safeguard, not real audio fingerprinting (which would need an
external service like ACRCloud/AudD + an API key).

**Automated 10-day review** (migration [`0008_auto_review.sql`](supabase/migrations/0008_auto_review.sql)):
submissions left pending for more than 10 days are examined automatically. The
`auto_review_stale_submissions()` function scans each one's text
(title/artist/album/note) for profanity/slurs and applies the copyright checks;
if anything is found it **rejects** the submission and writes a generated
`rejection_reason` the creator sees in *My submissions*. A **pg_cron** job runs it
daily at 03:00 UTC, and admins can trigger it immediately with **Run auto-review**
on the Submissions tab.

- If the `create extension pg_cron` / `cron.schedule` lines error, enable pg_cron
  first: **Dashboard → Database → Extensions → pg_cron**, then re-run the file.
- Extend the profanity list inside the function's `bad_words` array as needed.
- **This examines text + catalog metadata, not the audio.** To have an AI listen
  to the actual recording for vulgar lyrics or copyright, add a Supabase Edge
  Function that transcribes the audio (e.g. Whisper) and/or calls an LLM
  (Anthropic) or a fingerprint API (ACRCloud/AudD), then writes the verdict back
  to `submissions` — it needs those API keys as function secrets.

## Notes

- **Email confirmation:** by default Supabase requires email confirmation on
  sign-up. To let users log in immediately during development, turn it off under
  **Authentication → Providers → Email → Confirm email**.
- **Cover art:** songs store a `cover_key` (`album1`…`album6`) that maps to the
  bundled images in `src/assets`. When you add real songs, either reuse those
  keys or extend `src/lib/covers.ts` / host artwork in Supabase Storage.
- **Audio:** songs stream from the public `audio` bucket via `audio_path`
  (see step 4b). Liked songs, volume, shuffle and repeat are handled client-side.
