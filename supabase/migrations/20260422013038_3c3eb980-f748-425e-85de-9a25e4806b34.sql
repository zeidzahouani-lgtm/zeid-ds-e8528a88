-- Create video_walls table
CREATE TABLE public.video_walls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rows INTEGER NOT NULL DEFAULT 2 CHECK (rows >= 1 AND rows <= 10),
  cols INTEGER NOT NULL DEFAULT 2 CHECK (cols >= 1 AND cols <= 10),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_walls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access video_walls"
  ON public.video_walls FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members manage establishment video_walls"
  ON public.video_walls FOR ALL TO authenticated
  USING (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))
  WITH CHECK (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id));

CREATE POLICY "Users manage own video_walls"
  ON public.video_walls FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anon read video_walls for player"
  ON public.video_walls FOR SELECT TO anon
  USING (true);

CREATE TRIGGER video_walls_updated_at
  BEFORE UPDATE ON public.video_walls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add wall columns to screens
ALTER TABLE public.screens
  ADD COLUMN wall_id UUID REFERENCES public.video_walls(id) ON DELETE SET NULL,
  ADD COLUMN wall_row INTEGER,
  ADD COLUMN wall_col INTEGER;

CREATE INDEX idx_screens_wall_id ON public.screens(wall_id);