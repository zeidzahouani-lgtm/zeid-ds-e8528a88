ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS wall_id uuid REFERENCES public.video_walls(id) ON DELETE SET NULL;
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS wall_mode text NOT NULL DEFAULT 'single' CHECK (wall_mode IN ('single','stretched','tiled'));
ALTER TABLE public.video_walls ADD COLUMN IF NOT EXISTS wall_layout_mode text NOT NULL DEFAULT 'stretched' CHECK (wall_layout_mode IN ('stretched','tiled'));
CREATE INDEX IF NOT EXISTS idx_layouts_wall_id ON public.layouts(wall_id);