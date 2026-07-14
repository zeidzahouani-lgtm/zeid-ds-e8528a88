
DROP POLICY IF EXISTS "Anon can update player runtime fields" ON public.screens;
CREATE POLICY "Anon can update player runtime fields" ON public.screens
  FOR UPDATE TO anon
  USING (slug IS NOT NULL)
  WITH CHECK (slug IS NOT NULL);
