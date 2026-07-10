-- Rocky music app — deep AI review results on submissions
-- Run this in Supabase after 0008:  Dashboard → SQL Editor → paste → Run.
--
-- Columns written by the `ai-review` Edge Function (transcription + Claude
-- judgment). `rejection_reason` (from 0008) still holds the reason shown to the
-- creator when the AI rejects a track.

alter table public.submissions add column if not exists ai_reviewed_at timestamptz;
alter table public.submissions add column if not exists ai_notes text;

-- ─────────────────────────────────────────────────────────────
-- OPTIONAL: schedule the deep AI review daily via pg_cron + pg_net.
-- Requires the Edge Function `ai-review` deployed and its secrets set
-- (see SUPABASE_SETUP.md §8). Fill in <PROJECT_REF> and <CRON_SECRET>, then
-- uncomment and run. It POSTs to the function, which reviews submissions
-- pending > 10 days.
-- ─────────────────────────────────────────────────────────────
-- create extension if not exists pg_net;
--
-- do $$ begin perform cron.unschedule('ai-review-stale'); exception when others then null; end $$;
--
-- select cron.schedule(
--   'ai-review-stale',
--   '30 3 * * *',
--   $cron$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/ai-review',
--     headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--     body    := '{}'::jsonb
--   );
--   $cron$
-- );
