-- Allow members of the same establishment to read each other's profiles
CREATE POLICY "Members can read profiles of same establishment"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_establishments ue1
    JOIN public.user_establishments ue2
      ON ue1.establishment_id = ue2.establishment_id
    WHERE ue1.user_id = auth.uid()
      AND ue2.user_id = profiles.id
  )
);