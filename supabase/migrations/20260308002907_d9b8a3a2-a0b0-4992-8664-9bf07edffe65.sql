
-- Layouts table
CREATE TABLE public.layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  width integer NOT NULL DEFAULT 1920,
  height integer NOT NULL DEFAULT 1080,
  background_color text NOT NULL DEFAULT '#000000',
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Layout regions table
CREATE TABLE public.layout_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.layouts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Region',
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 300,
  height integer NOT NULL DEFAULT 200,
  z_index integer NOT NULL DEFAULT 0,
  media_id uuid REFERENCES public.media(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layout_regions ENABLE ROW LEVEL SECURITY;

-- RLS for layouts
CREATE POLICY "Users can read own layouts" ON public.layouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own layouts" ON public.layouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own layouts" ON public.layouts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own layouts" ON public.layouts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read layouts for player" ON public.layouts FOR SELECT USING (true);

-- RLS for layout_regions (through layout ownership)
CREATE POLICY "Users can read own layout_regions" ON public.layout_regions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.layouts WHERE layouts.id = layout_regions.layout_id AND layouts.user_id = auth.uid()));
CREATE POLICY "Users can insert own layout_regions" ON public.layout_regions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.layouts WHERE layouts.id = layout_regions.layout_id AND layouts.user_id = auth.uid()));
CREATE POLICY "Users can update own layout_regions" ON public.layout_regions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.layouts WHERE layouts.id = layout_regions.layout_id AND layouts.user_id = auth.uid()));
CREATE POLICY "Users can delete own layout_regions" ON public.layout_regions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.layouts WHERE layouts.id = layout_regions.layout_id AND layouts.user_id = auth.uid()));
CREATE POLICY "Anyone can read layout_regions for player" ON public.layout_regions FOR SELECT USING (true);

-- Updated_at trigger for layouts
CREATE TRIGGER update_layouts_updated_at BEFORE UPDATE ON public.layouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for layout_regions
ALTER PUBLICATION supabase_realtime ADD TABLE public.layout_regions;
