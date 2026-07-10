-- Rocky music app — admin portal: roles, profiles, and admin-only write access
-- Run this in Supabase after 0003:  Dashboard → SQL Editor → paste → Run.
--
-- Security model (defense in depth):
--   • Every user gets a row in public.profiles (created by a trigger).
--   • public.is_admin() is a SECURITY DEFINER function so RLS policies can check
--     admin status without recursion and without exposing the service_role key.
--   • Songs/playlists/albums/artists stay publicly READable, but only admins can
--     INSERT/UPDATE/DELETE — enforced by the database, so a tampered client
--     cannot write. The admin UI guard is only a convenience layer on top.

-- ─────────────────────────────────────────────────────────────
-- Profiles (one per auth user)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admin check that bypasses RLS (definer) to avoid policy recursion.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and is_admin);
$$;

-- Auto-create a profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who already exist.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Profiles RLS: you can read your own; admins can read all; only admins update.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Read own or admin all') then
    create policy "Read own or admin all" on public.profiles
      for select to authenticated
      using (id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Admins update profiles') then
    create policy "Admins update profiles" on public.profiles
      for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Admin-only write access to the catalog (reads stay public from 0001/0002)
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['songs', 'playlists', 'albums', 'artists'] loop
    if not exists (
      select 1 from pg_policies
      where tablename = t and policyname = 'Admins manage ' || t
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
        'Admins manage ' || t, t
      );
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Make yourself an admin — EDIT the email, then this line runs.
-- (You must have signed up in the app first so the profile exists.)
-- ─────────────────────────────────────────────────────────────
update public.profiles set is_admin = true
where email = 'saifujani2006@gmail.com';
