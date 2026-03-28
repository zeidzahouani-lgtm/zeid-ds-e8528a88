
-- Allow establishment members to read licenses for screens in their establishment
CREATE POLICY "Users can read licenses via establishment screens"
ON public.licenses FOR SELECT
TO authenticated
USING (
  screen_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.screens s
    WHERE s.id = licenses.screen_id
    AND s.establishment_id IS NOT NULL
    AND is_member_of(auth.uid(), s.establishment_id)
  )
);

-- Allow establishment members (not just admins) to manage establishment_settings
CREATE POLICY "Establishment members manage their settings"
ON public.establishment_settings FOR ALL
TO authenticated
USING (is_member_of(auth.uid(), establishment_id))
WITH CHECK (is_member_of(auth.uid(), establishment_id));
