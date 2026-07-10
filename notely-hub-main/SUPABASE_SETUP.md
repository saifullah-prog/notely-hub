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

## 8. Deep AI review (optional — transcribe + fingerprint + Claude)

The rule-based reviewer (step 7 / migration 0008) only reads text. To have an AI
actually **listen to the audio** — transcribe the lyrics and let Claude judge
vulgarity + likely copyright — deploy the `ai-review` Edge Function
([`supabase/functions/ai-review/index.ts`](supabase/functions/ai-review/index.ts)).

**Prereqs:** run migration [`0009_ai_review.sql`](supabase/migrations/0009_ai_review.sql)
(adds `ai_reviewed_at` + `ai_notes`), and have the [Supabase CLI](https://supabase.com/docs/guides/cli).

**Deploy + set secrets:**
```bash
supabase functions deploy ai-review
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-...        # Claude (judgment + rejection reason) — required \
  TRANSCRIBE_KEY=sk-...               # OpenAI Whisper key (audio → lyrics) — optional \
  CRON_SECRET=$(openssl rand -hex 16) # only if you schedule it (below)
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
```
- Missing `TRANSCRIBE_KEY` → transcription is skipped (Claude judges on metadata
  only). Missing `ANTHROPIC_API_KEY` → the function no-ops.
- Copyright detection here is best-effort from lyrics/metadata (no audio
  fingerprint service); to add true fingerprinting later, wire an ACRCloud/AudD
  call into the function.
- To use **Groq** instead of OpenAI for transcription, also set
  `TRANSCRIBE_URL=https://api.groq.com/openai/v1/audio/transcriptions` and
  `TRANSCRIBE_MODEL=whisper-large-v3`.

**Use it:** in the admin **Submissions** tab, click **Deep AI review**. It
examines submissions pending > 10 days (or pass `{ all_pending: true }` /
`{ submission_id }` when invoking directly), writes an `ai_notes` summary on each,
and **rejects** with a generated reason when it finds vulgarity or copyright.

**Schedule it daily** (optional): uncomment the `pg_cron` block at the bottom of
`0009_ai_review.sql`, fill in your project ref + `CRON_SECRET`, and run it.

> Security: the API keys live as **function secrets**, never in the app bundle.
> The function verifies the caller is an admin (or presents the cron secret)
> before running, and only the `service_role` inside the function writes results.
> This function is deployed/tested by you — it can't be verified from the app repo.

## 9. Premium subscriptions (admin-verified manual payments)

A manual monthly-subscription flow — no card gateway. The **admin** controls
everything; **creators** pay externally and submit proof; the admin verifies.

**Set it up:** run migration [`0010_subscriptions.sql`](supabase/migrations/0010_subscriptions.sql)
(creates `payment_settings`, `payments`, and `profiles.premium_until` with RLS).

**How it works:**
1. Admin portal → **Premium** tab: set the **monthly amount**, **currency**,
   **payment method**, **instructions** (your account details), and toggle
   **subscriptions open/closed**. You can stop subscriptions or change the amount
   anytime — creators only see what you set.
2. A creator opens **Premium** (the crown button in the top bar, or "Explore
   Premium") → sees your method + amount + instructions → pays you externally →
   fills the **verify-my-payment** form (transaction id, sender name, amount).
3. That submission appears in the admin **Premium** tab with a **pending badge**
   (this is the "notification"). Admin clicks **Approve** → grants **1 month** of
   premium (`profiles.premium_until`, extending an active sub), or **Reject**.

Everything is enforced by RLS: creators can only see/insert their own payments;
only admins change settings, verify payments, or set premium expiry. Premium
status is available via the `premium_until` column for gating premium-only
features later.

## Notes

- **Email confirmation:** by default Supabase requires email confirmation on
  sign-up. To let users log in immediately during development, turn it off under
  **Authentication → Providers → Email → Confirm email**.
- **Cover art:** songs store a `cover_key` (`album1`…`album6`) that maps to the
  bundled images in `src/assets`. When you add real songs, either reuse those
  keys or extend `src/lib/covers.ts` / host artwork in Supabase Storage.
- **Audio:** songs stream from the public `audio` bucket via `audio_path`
  (see step 4b). Liked songs, volume, shuffle and repeat are handled client-side.
