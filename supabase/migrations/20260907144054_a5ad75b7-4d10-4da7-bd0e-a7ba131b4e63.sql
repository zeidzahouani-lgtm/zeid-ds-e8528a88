ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS default_media_id uuid REFERENCES public.media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL;