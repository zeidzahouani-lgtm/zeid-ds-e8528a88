-- Add playlist_id to schedules so a schedule can target a playlist (in addition to a single media)
ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedules_playlist_id ON public.schedules(playlist_id);

-- Make media_id explicitly nullable (it already is, but kept for clarity)
ALTER TABLE public.schedules ALTER COLUMN media_id DROP NOT NULL;