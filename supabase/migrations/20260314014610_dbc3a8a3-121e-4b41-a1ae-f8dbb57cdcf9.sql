CREATE POLICY "Anon can update license screen_id for activation"
ON public.licenses
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);