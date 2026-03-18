-- Fix layout editing/deletion permissions for admin and establishment members
-- Layouts: allow global admins to manage all rows
DROP POLICY IF EXISTS "Admins can manage all layouts" ON public.layouts;
CREATE POLICY "Admins can manage all layouts"
ON public.layouts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Layout regions: allow establishment members (same establishment as layout) to manage regions
DROP POLICY IF EXISTS "Users can insert establishment layout_regions" ON public.layout_regions;
CREATE POLICY "Users can insert establishment layout_regions"
ON public.layout_regions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.layouts l
    WHERE l.id = layout_regions.layout_id
      AND l.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), l.establishment_id)
  )
);

DROP POLICY IF EXISTS "Users can update establishment layout_regions" ON public.layout_regions;
CREATE POLICY "Users can update establishment layout_regions"
ON public.layout_regions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.layouts l
    WHERE l.id = layout_regions.layout_id
      AND l.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), l.establishment_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.layouts l
    WHERE l.id = layout_regions.layout_id
      AND l.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), l.establishment_id)
  )
);

DROP POLICY IF EXISTS "Users can delete establishment layout_regions" ON public.layout_regions;
CREATE POLICY "Users can delete establishment layout_regions"
ON public.layout_regions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.layouts l
    WHERE l.id = layout_regions.layout_id
      AND l.establishment_id IS NOT NULL
      AND public.is_member_of(auth.uid(), l.establishment_id)
  )
);

-- Layout regions: allow global admins to manage all rows
DROP POLICY IF EXISTS "Admins can manage all layout_regions" ON public.layout_regions;
CREATE POLICY "Admins can manage all layout_regions"
ON public.layout_regions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));