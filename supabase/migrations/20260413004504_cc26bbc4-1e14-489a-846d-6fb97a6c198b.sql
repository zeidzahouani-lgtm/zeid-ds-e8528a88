CREATE POLICY "Establishment admins can remove members"
ON public.user_establishments
FOR DELETE
TO authenticated
USING (establishment_role(auth.uid(), establishment_id) = 'admin');