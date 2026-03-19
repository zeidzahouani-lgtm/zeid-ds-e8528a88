
ALTER TABLE public.licenses 
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL;
