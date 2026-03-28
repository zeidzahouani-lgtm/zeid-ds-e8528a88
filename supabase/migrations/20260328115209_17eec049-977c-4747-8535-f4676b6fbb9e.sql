-- Allow establishment members to update their own establishment
CREATE POLICY "Members can update their establishment"
ON public.establishments FOR UPDATE
TO authenticated
USING (is_member_of(auth.uid(), id))
WITH CHECK (is_member_of(auth.uid(), id));