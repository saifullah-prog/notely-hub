-- Rocky music app — copyright awareness for submissions
-- Run this in Supabase after 0006:  Dashboard → SQL Editor → paste → Run.
--
-- Creators must declare the rights status of their track and confirm ownership.
-- The admin review then combines this declaration with automatic heuristic
-- checks (duplicate title/artist, artist-name collisions, missing attestation)
-- to warn before publishing. This is a lightweight safeguard — not a substitute
-- for real audio fingerprinting (which needs an external service).

alter table public.submissions
  add column if not exists rights text not null default 'original'
  check (rights in ('original', 'licensed', 'cover', 'unknown'));

alter table public.submissions
  add column if not exists owns_rights boolean not null default false;
