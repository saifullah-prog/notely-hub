-- Rocky music app — audio playback via Supabase Storage
-- Run this in Supabase after 0002:  Dashboard → SQL Editor → paste → Run.
--
-- Adds `audio_path` to songs (the object path inside the `audio` bucket), creates
-- a public `audio` storage bucket, and sets read/upload policies. After running,
-- upload one MP3 per song to the bucket at the matching path (see SONGS_AUDIO
-- notes / SUPABASE_SETUP.md). Playback resolves the public URL from `audio_path`.

-- 1. Path to the track's audio file inside the `audio` bucket.
alter table public.songs add column if not exists audio_path text;

update public.songs set audio_path = 'aurora-wave/neon-peaks.mp3'        where title = 'Neon Peaks'         and artist = 'Aurora Wave';
update public.songs set audio_path = 'aurora-wave/midnight-ridge.mp3'    where title = 'Midnight Ridge'     and artist = 'Aurora Wave';
update public.songs set audio_path = 'palm-coast/sunset-drive.mp3'       where title = 'Sunset Drive'       and artist = 'Palm Coast';
update public.songs set audio_path = 'palm-coast/ocean-boulevard.mp3'    where title = 'Ocean Boulevard'    and artist = 'Palm Coast';
update public.songs set audio_path = 'vera-lune/quiet-hours.mp3'         where title = 'Quiet Hours'        and artist = 'Vera Lune';
update public.songs set audio_path = 'vera-lune/paper-moon.mp3'          where title = 'Paper Moon'         and artist = 'Vera Lune';
update public.songs set audio_path = 'nebula-9/cosmic-drift.mp3'         where title = 'Cosmic Drift'       and artist = 'Nebula 9';
update public.songs set audio_path = 'nebula-9/event-horizon.mp3'        where title = 'Event Horizon'      and artist = 'Nebula 9';
update public.songs set audio_path = 'block-party/concrete-kings.mp3'    where title = 'Concrete Kings'     and artist = 'Block Party';
update public.songs set audio_path = 'block-party/corner-store.mp3'      where title = 'Corner Store'       and artist = 'Block Party';
update public.songs set audio_path = 'june-bloom/cotton-sky.mp3'         where title = 'Cotton Sky'         and artist = 'June Bloom';
update public.songs set audio_path = 'june-bloom/marshmallow-clouds.mp3' where title = 'Marshmallow Clouds' and artist = 'June Bloom';

-- 2. Public bucket for audio files.
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do update set public = true;

-- 3. Storage policies: anyone can read; signed-in users can upload/update/delete.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read audio') then
    create policy "Public read audio" on storage.objects
      for select using (bucket_id = 'audio');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated write audio') then
    create policy "Authenticated write audio" on storage.objects
      for insert to authenticated with check (bucket_id = 'audio');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated update audio') then
    create policy "Authenticated update audio" on storage.objects
      for update to authenticated using (bucket_id = 'audio');
  end if;
end $$;
