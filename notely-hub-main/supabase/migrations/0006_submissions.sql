-- Rocky music app — creator submissions (upload → admin approval)
-- Run this in Supabase after 0005:  Dashboard → SQL Editor → paste → Run.
--
-- A creator records/uploads audio and submits a track for publishing. The row
-- lands here with status 'pending' and shows up in the admin portal. On approve
-- the admin copies it into public.songs (the live catalog). Audio files are
-- stored in the existing public `audio` bucket (authenticated write policy from
-- migration 0003), under a `submissions/<user_id>/…` path.

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  artist      text not null,
  album       text not null,
  duration    text not null,
  cover_key   text not null default 'album1',
  audio_path  text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note        text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table public.submissions enable row level security;

do $$
begin
  -- Creators can submit their own tracks.
  if not exists (select 1 from pg_policies where tablename = 'submissions' and policyname = 'Creators insert own') then
    create policy "Creators insert own" on public.submissions
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  -- Creators see their own; admins see everything.
  if not exists (select 1 from pg_policies where tablename = 'submissions' and policyname = 'Read own or admin all') then
    create policy "Read own or admin all" on public.submissions
      for select to authenticated
      using (user_id = auth.uid() or public.is_admin());
  end if;
  -- Creators can delete their own pending submissions.
  if not exists (select 1 from pg_policies where tablename = 'submissions' and policyname = 'Creators delete own pending') then
    create policy "Creators delete own pending" on public.submissions
      for delete to authenticated
      using (user_id = auth.uid() and status = 'pending');
  end if;
  -- Only admins can review (approve/reject).
  if not exists (select 1 from pg_policies where tablename = 'submissions' and policyname = 'Admins review') then
    create policy "Admins review" on public.submissions
      for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
