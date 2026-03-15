CREATE POLICY "Anon can read establishment settings for player"
ON public.establishment_settings
FOR SELECT
TO anon
USING (true);