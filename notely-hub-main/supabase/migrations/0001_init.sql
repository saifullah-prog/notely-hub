-- Rocky music app — initial schema + seed
-- Run this in Supabase: Dashboard → SQL Editor → paste → Run,
-- or with the CLI:  supabase db push
--
-- `cover_key` maps to the bundled cover images (album1 … album6) in src/assets,
-- so the client can resolve artwork without hosting the images yet.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  cover_key  text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.albums (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  artist     text not null,
  cover_key  text not null,
  tint       text,
  created_at timestamptz not null default now(),
  unique (title, artist)
);

create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  artist     text not null,
  album      text not null,
  duration   text not null,
  cover_key  text not null,
  created_at timestamptz not null default now(),
  unique (title, artist)
);

create table if not exists public.playlists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sub        text,
  cover_key  text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: catalog is publicly readable, writes locked down
-- ─────────────────────────────────────────────────────────────

alter table public.artists   enable row level security;
alter table public.albums    enable row level security;
alter table public.songs     enable row level security;
alter table public.playlists enable row level security;

do $$
begin
  -- Public read policies (idempotent)
  if not exists (select 1 from pg_policies where tablename = 'songs' and policyname = 'Public read songs') then
    create policy "Public read songs" on public.songs for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'albums' and policyname = 'Public read albums') then
    create policy "Public read albums" on public.albums for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'artists' and policyname = 'Public read artists') then
    create policy "Public read artists" on public.artists for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'playlists' and policyname = 'Public read playlists') then
    create policy "Public read playlists" on public.playlists for select using (true);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Seed: all songs currently shipped in the app
-- ─────────────────────────────────────────────────────────────

insert into public.artists (name, cover_key) values
  ('Aurora Wave', 'album1'),
  ('Palm Coast',  'album2'),
  ('Vera Lune',   'album3'),
  ('Nebula 9',    'album4'),
  ('Block Party', 'album5'),
  ('June Bloom',  'album6')
on conflict (name) do update set cover_key = excluded.cover_key;

insert into public.albums (title, artist, cover_key, tint) values
  ('Neon Peaks',      'Aurora Wave', 'album1', 'from-purple-900'),
  ('Sunset Drive',    'Palm Coast',  'album2', 'from-pink-900'),
  ('Quiet Hours',     'Vera Lune',   'album3', 'from-slate-800'),
  ('Cosmic Drift',    'Nebula 9',    'album4', 'from-indigo-900'),
  ('Concrete Kings',  'Block Party', 'album5', 'from-red-900'),
  ('Cotton Sky',      'June Bloom',  'album6', 'from-sky-800')
on conflict (title, artist) do update
  set cover_key = excluded.cover_key, tint = excluded.tint;

insert into public.songs (title, artist, album, duration, cover_key) values
  ('Neon Peaks',         'Aurora Wave', 'Neon Peaks',     '3:42', 'album1'),
  ('Midnight Ridge',     'Aurora Wave', 'Neon Peaks',     '4:11', 'album1'),
  ('Sunset Drive',       'Palm Coast',  'Sunset Drive',   '3:28', 'album2'),
  ('Ocean Boulevard',    'Palm Coast',  'Sunset Drive',   '3:55', 'album2'),
  ('Quiet Hours',        'Vera Lune',   'Quiet Hours',    '4:02', 'album3'),
  ('Paper Moon',         'Vera Lune',   'Quiet Hours',    '3:18', 'album3'),
  ('Cosmic Drift',       'Nebula 9',    'Cosmic Drift',   '5:07', 'album4'),
  ('Event Horizon',      'Nebula 9',    'Cosmic Drift',   '6:22', 'album4'),
  ('Concrete Kings',     'Block Party', 'Concrete Kings', '3:12', 'album5'),
  ('Corner Store',       'Block Party', 'Concrete Kings', '2:58', 'album5'),
  ('Cotton Sky',         'June Bloom',  'Cotton Sky',     '3:33', 'album6'),
  ('Marshmallow Clouds', 'June Bloom',  'Cotton Sky',     '3:47', 'album6')
on conflict (title, artist) do update
  set album = excluded.album, duration = excluded.duration, cover_key = excluded.cover_key;

insert into public.playlists (name, sub, cover_key) values
  ('Liked Songs',         'Playlist • 247 songs',           'album3'),
  ('Daily Mix 1',         'Aurora Wave, Nebula 9 and more', 'album1'),
  ('Discover Weekly',     'Your weekly mixtape',            'album4'),
  ('Chill Vibes',         'Made for you',                   'album6'),
  ('Late Night Drive',    'Palm Coast, Block Party',        'album2'),
  ('Underground Hip Hop', 'Fresh cuts weekly',              'album5'),
  ('Focus Flow',          'Deep concentration',             'album3')
on conflict (name) do update
  set sub = excluded.sub, cover_key = excluded.cover_key;
