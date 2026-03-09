
-- Create establishments table
CREATE TABLE public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

-- Junction table: which users have access to which establishments
CREATE TABLE public.user_establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, establishment_id)
);

ALTER TABLE public.user_establishments ENABLE ROW LEVEL SECURITY;

-- Add establishment_id to screens
ALTER TABLE public.screens ADD COLUMN establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL;

-- RLS for establishments: admins see all, users see their own
CREATE POLICY "Admins full access to establishments" ON public.establishments
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their establishments" ON public.establishments
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_establishments WHERE user_id = auth.uid() AND establishment_id = establishments.id)
);

-- RLS for user_establishments
CREATE POLICY "Admins full access to user_establishments" ON public.user_establishments
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own user_establishments" ON public.user_establishments
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Update trigger for establishments
CREATE TRIGGER update_establishments_updated_at
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
