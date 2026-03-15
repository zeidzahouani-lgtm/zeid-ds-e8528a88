
-- 1. Add establishment_id to media
ALTER TABLE public.media ADD COLUMN establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL;

-- 2. Add establishment_id to layouts
ALTER TABLE public.layouts ADD COLUMN establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL;

-- 3. Add role to user_establishments
ALTER TABLE public.user_establishments ADD COLUMN role text NOT NULL DEFAULT 'member';

-- 4. Create establishment_settings table
CREATE TABLE public.establishment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(establishment_id, key)
);

ALTER TABLE public.establishment_settings ENABLE ROW LEVEL SECURITY;

-- 5. Helper function: check if user belongs to an establishment
CREATE OR REPLACE FUNCTION public.is_member_of(_user_id uuid, _establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_establishments
    WHERE user_id = _user_id AND establishment_id = _establishment_id
  )
$$;

-- 6. Helper function: check establishment role
CREATE OR REPLACE FUNCTION public.establishment_role(_user_id uuid, _establishment_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_establishments
  WHERE user_id = _user_id AND establishment_id = _establishment_id
  LIMIT 1
$$;

-- 7. RLS for establishment_settings
CREATE POLICY "Global admins full access" ON public.establishment_settings
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Establishment admins manage their settings" ON public.establishment_settings
FOR ALL TO authenticated USING (
  establishment_role(auth.uid(), establishment_id) = 'admin'
);

CREATE POLICY "Establishment members read settings" ON public.establishment_settings
FOR SELECT TO authenticated USING (
  is_member_of(auth.uid(), establishment_id)
);

-- 8. Additional RLS for media: establishment-scoped access
CREATE POLICY "Users can read establishment media" ON public.media
FOR SELECT TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can insert establishment media" ON public.media
FOR INSERT TO authenticated WITH CHECK (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can update establishment media" ON public.media
FOR UPDATE TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can delete establishment media" ON public.media
FOR DELETE TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

-- 9. Additional RLS for layouts: establishment-scoped access
CREATE POLICY "Users can read establishment layouts" ON public.layouts
FOR SELECT TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can insert establishment layouts" ON public.layouts
FOR INSERT TO authenticated WITH CHECK (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can update establishment layouts" ON public.layouts
FOR UPDATE TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can delete establishment layouts" ON public.layouts
FOR DELETE TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

-- 10. Additional RLS for screens: establishment-scoped access
CREATE POLICY "Users can read establishment screens" ON public.screens
FOR SELECT TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);

CREATE POLICY "Users can update establishment screens" ON public.screens
FOR UPDATE TO authenticated USING (
  establishment_id IS NOT NULL AND is_member_of(auth.uid(), establishment_id)
);
