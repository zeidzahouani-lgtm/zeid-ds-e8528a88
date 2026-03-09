
ALTER TABLE public.screens ADD COLUMN layout_id uuid REFERENCES public.layouts(id) ON DELETE SET NULL;
