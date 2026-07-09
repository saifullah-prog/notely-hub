-- Rocky music app — add per-artist playlists
-- Run this in Supabase after 0001_init.sql:
--   Dashboard → SQL Editor → paste → Run.
--
-- Adds an `artist` column to playlists and seeds a set of playlists for every
-- artist in the catalog (This Is / Radio / Essentials). `cover_key` reuses the
-- artist's album artwork (album1 … album6).

-- 1. Track which artist a playlist belongs to (null = editorial/general playlist)
alter table public.playlists add column if not exists artist text;

-- 2. Seed playlists for every artist
insert into public.playlists (name, sub, cover_key, artist) values
  -- Aurora Wave (album1)
  ('This Is Aurora Wave', 'The essential tracks, all in one playlist', 'album1', 'Aurora Wave'),
  ('Aurora Wave Radio',   'With Nebula 9, Palm Coast and more',        'album1', 'Aurora Wave'),
  ('Aurora Wave Essentials', 'Fan favourites and deep cuts',           'album1', 'Aurora Wave'),

  -- Palm Coast (album2)
  ('This Is Palm Coast', 'The essential tracks, all in one playlist', 'album2', 'Palm Coast'),
  ('Palm Coast Radio',   'With June Bloom, Aurora Wave and more',     'album2', 'Palm Coast'),
  ('Palm Coast Essentials', 'Fan favourites and deep cuts',          'album2', 'Palm Coast'),

  -- Vera Lune (album3)
  ('This Is Vera Lune', 'The essential tracks, all in one playlist', 'album3', 'Vera Lune'),
  ('Vera Lune Radio',   'With June Bloom, Aurora Wave and more',     'album3', 'Vera Lune'),
  ('Vera Lune Essentials', 'Fan favourites and deep cuts',          'album3', 'Vera Lune'),

  -- Nebula 9 (album4)
  ('This Is Nebula 9', 'The essential tracks, all in one playlist', 'album4', 'Nebula 9'),
  ('Nebula 9 Radio',   'With Aurora Wave, Block Party and more',    'album4', 'Nebula 9'),
  ('Nebula 9 Essentials', 'Fan favourites and deep cuts',          'album4', 'Nebula 9'),

  -- Block Party (album5)
  ('This Is Block Party', 'The essential tracks, all in one playlist', 'album5', 'Block Party'),
  ('Block Party Radio',   'With Nebula 9, Palm Coast and more',        'album5', 'Block Party'),
  ('Block Party Essentials', 'Fan favourites and deep cuts',           'album5', 'Block Party'),

  -- June Bloom (album6)
  ('This Is June Bloom', 'The essential tracks, all in one playlist', 'album6', 'June Bloom'),
  ('June Bloom Radio',   'With Palm Coast, Vera Lune and more',       'album6', 'June Bloom'),
  ('June Bloom Essentials', 'Fan favourites and deep cuts',           'album6', 'June Bloom')
on conflict (name) do update
  set sub = excluded.sub, cover_key = excluded.cover_key, artist = excluded.artist;
