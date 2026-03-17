
-- 1. Playlists table (named playlist containers)
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid,
  establishment_id uuid REFERENCES public.establishments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own playlists" ON public.playlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access establishment playlists" ON public.playlists FOR ALL TO authenticated USING (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)) WITH CHECK (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id));
CREATE POLICY "Anon read playlists" ON public.playlists FOR SELECT TO anon USING (true);

-- 2. Programs table (named schedule containers)
CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid,
  establishment_id uuid REFERENCES public.establishments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own programs" ON public.programs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access establishment programs" ON public.programs FOR ALL TO authenticated USING (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)) WITH CHECK (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id));
CREATE POLICY "Anon read programs" ON public.programs FOR SELECT TO anon USING (true);

-- 3. Add playlist_id to playlist_items, make screen_id nullable
ALTER TABLE public.playlist_items ADD COLUMN playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE;
ALTER TABLE public.playlist_items ALTER COLUMN screen_id DROP NOT NULL;

-- 4. Add program_id to schedules, make screen_id nullable
ALTER TABLE public.schedules ADD COLUMN program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE;
ALTER TABLE public.schedules ALTER COLUMN screen_id DROP NOT NULL;

-- 5. Add playlist_id and program_id to screens
ALTER TABLE public.screens ADD COLUMN playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL;
ALTER TABLE public.screens ADD COLUMN program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;

-- 6. RLS for playlist_items via playlist ownership
CREATE POLICY "Users can read playlist items via playlist" ON public.playlist_items FOR SELECT TO authenticated USING (
  playlist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_items.playlist_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
CREATE POLICY "Users can insert playlist items via playlist" ON public.playlist_items FOR INSERT TO authenticated WITH CHECK (
  playlist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_items.playlist_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
CREATE POLICY "Users can update playlist items via playlist" ON public.playlist_items FOR UPDATE TO authenticated USING (
  playlist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_items.playlist_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
CREATE POLICY "Users can delete playlist items via playlist" ON public.playlist_items FOR DELETE TO authenticated USING (
  playlist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_items.playlist_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);

-- 7. RLS for schedules via program ownership
CREATE POLICY "Users can read schedules via program" ON public.schedules FOR SELECT TO authenticated USING (
  program_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.programs WHERE id = schedules.program_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
CREATE POLICY "Users can insert schedules via program" ON public.schedules FOR INSERT TO authenticated WITH CHECK (
  program_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.programs WHERE id = schedules.program_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
CREATE POLICY "Users can update schedules via program" ON public.schedules FOR UPDATE TO authenticated USING (
  program_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.programs WHERE id = schedules.program_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
CREATE POLICY "Users can delete schedules via program" ON public.schedules FOR DELETE TO authenticated USING (
  program_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.programs WHERE id = schedules.program_id AND (user_id = auth.uid() OR (establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id))))
);
