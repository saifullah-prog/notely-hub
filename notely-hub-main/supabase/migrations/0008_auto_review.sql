-- Rocky music app — automated review of stale submissions
-- Run this in Supabase after 0007:  Dashboard → SQL Editor → paste → Run.
--
-- Submissions left pending for more than 10 days are examined automatically:
-- their text (title/artist/album/note) is scanned for profanity/slurs and the
-- copyright heuristics are applied. If anything is found the submission is
-- rejected with a generated reason the creator can read. A daily pg_cron job
-- runs the check; admins can also trigger it on demand.
--
-- NOTE: this examines submission TEXT + catalog metadata, not the audio itself.
-- Analysing the actual recording (vulgar lyrics / copyright fingerprint) needs an
-- external AI/transcription service — see SUPABASE_SETUP.md for the upgrade path.

-- 1. Store the reason a submission was rejected (shown to the creator).
alter table public.submissions add column if not exists rejection_reason text;

-- 2. The examiner. Returns how many submissions it rejected.
create or replace function public.auto_review_stale_submissions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s        record;
  reasons  text[];
  hay      text;
  w        text;
  rejected int := 0;
  -- Profanity / slur list for text moderation. Extend as needed.
  bad_words text[] := array[
    'fuck','shit','bitch','asshole','bastard','dick','pussy','cunt','slut','whore',
    'nigger','nigga','faggot','retard','rape'
  ];
begin
  for s in
    select * from public.submissions
    where status = 'pending'
      and created_at < now() - interval '10 days'
  loop
    reasons := array[]::text[];
    hay := lower(
      coalesce(s.title, '') || ' ' || coalesce(s.artist, '') || ' ' ||
      coalesce(s.album, '') || ' ' || coalesce(s.note, '')
    );

    -- Vulgarity (whole-word, case-insensitive).
    foreach w in array bad_words loop
      if hay ~* ('\y' || w || '\y') then
        reasons := array_append(reasons, 'it contains inappropriate or vulgar language');
        exit;
      end if;
    end loop;

    -- Copyright / rights checks.
    if not s.owns_rights then
      reasons := array_append(reasons, 'the creator did not confirm they own or have rights to the audio');
    end if;
    if s.rights = 'cover' then
      reasons := array_append(reasons, 'it was declared a cover and no distribution license was provided');
    end if;
    if exists (
      select 1 from public.songs g
      where lower(g.title) = lower(s.title) and lower(g.artist) = lower(s.artist)
    ) then
      reasons := array_append(reasons, 'it duplicates a track already in the catalog');
    elsif exists (
      select 1 from public.songs g where lower(g.artist) = lower(s.artist)
    ) then
      reasons := array_append(reasons, 'the artist name matches an existing catalog artist (possible impersonation)');
    end if;

    if array_length(reasons, 1) > 0 then
      update public.submissions
      set status = 'rejected',
          reviewed_at = now(),
          reviewed_by = null,
          rejection_reason =
            'Automated review (pending over 10 days): rejected because ' ||
            array_to_string(reasons, '; ') ||
            '. If you believe this is a mistake, please resubmit with corrected details or proof of rights.'
      where id = s.id;
      rejected := rejected + 1;
    end if;
  end loop;

  return rejected;
end;
$$;

-- Let signed-in admins trigger it on demand via RPC (cron runs as owner anyway).
revoke execute on function public.auto_review_stale_submissions() from public;
grant execute on function public.auto_review_stale_submissions() to authenticated;

-- 3. Schedule it daily at 03:00 UTC via pg_cron.
--    If this errors, enable pg_cron first: Dashboard → Database → Extensions → pg_cron.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('auto-review-stale-submissions');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'auto-review-stale-submissions',
  '0 3 * * *',
  $cron$ select public.auto_review_stale_submissions(); $cron$
);
