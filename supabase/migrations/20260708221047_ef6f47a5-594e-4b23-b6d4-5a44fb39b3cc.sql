-- schedules: allow establishment members to manage schedules on shared screens
CREATE POLICY "Members can read schedules on establishment screens"
ON public.schedules FOR SELECT TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = schedules.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

CREATE POLICY "Members can insert schedules on establishment screens"
ON public.schedules FOR INSERT TO authenticated
WITH CHECK (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = schedules.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

CREATE POLICY "Members can update schedules on establishment screens"
ON public.schedules FOR UPDATE TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = schedules.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

CREATE POLICY "Members can delete schedules on establishment screens"
ON public.schedules FOR DELETE TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = schedules.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

-- playlist_items: allow establishment members to manage items attached directly to shared screens
CREATE POLICY "Members can read playlist_items on establishment screens"
ON public.playlist_items FOR SELECT TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = playlist_items.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

CREATE POLICY "Members can insert playlist_items on establishment screens"
ON public.playlist_items FOR INSERT TO authenticated
WITH CHECK (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = playlist_items.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

CREATE POLICY "Members can update playlist_items on establishment screens"
ON public.playlist_items FOR UPDATE TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = playlist_items.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);

CREATE POLICY "Members can delete playlist_items on establishment screens"
ON public.playlist_items FOR DELETE TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = playlist_items.screen_id
      AND s.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), s.establishment_id)
  )
);