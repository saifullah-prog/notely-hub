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

(Or, with the Supabase CLI linked to your project: `supabase db push`.)

## 5. Run the app

```bash
bun dev
```

- Visit `/login` to sign up / log in.
- The home page reads songs from the `songs` table. If Supabase isn't
  configured or is unreachable, it automatically falls back to the bundled song
  list, so the UI never breaks.

## Notes

- **Email confirmation:** by default Supabase requires email confirmation on
  sign-up. To let users log in immediately during development, turn it off under
  **Authentication → Providers → Email → Confirm email**.
- **Cover art:** songs store a `cover_key` (`album1`…`album6`) that maps to the
  bundled images in `src/assets`. When you add real songs, either reuse those
  keys or extend `src/lib/covers.ts` / host artwork in Supabase Storage.
