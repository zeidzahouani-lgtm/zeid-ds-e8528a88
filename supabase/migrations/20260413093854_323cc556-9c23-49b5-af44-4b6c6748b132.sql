
CREATE POLICY "Admins can delete all screens"
ON public.screens
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Establishment admins can delete screens"
ON public.screens
FOR DELETE
TO authenticated
USING (
  establishment_id IS NOT NULL
  AND establishment_role(auth.uid(), establishment_id) = 'admin'
);
