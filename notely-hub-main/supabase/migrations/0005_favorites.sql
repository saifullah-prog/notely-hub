-- Rocky music app — per-user favourites (liked songs)
-- Run this in Supabase after 0004:  Dashboard → SQL Editor → paste → Run.
--
-- Each row is one liked track for one user. `track_key` is "Title__Artist"
-- (the client's stable per-track key). RLS ensures a user can only see and
-- modify their own favourites.

create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  track_key  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, track_key)
);

alter table public.favorites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'favorites' and policyname = 'Users manage own favorites') then
    create policy "Users manage own favorites" on public.favorites
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
