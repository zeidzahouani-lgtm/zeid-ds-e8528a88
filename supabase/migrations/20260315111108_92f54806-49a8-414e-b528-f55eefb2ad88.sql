ALTER TABLE public.layouts 
  ADD COLUMN IF NOT EXISTS bg_type text NOT NULL DEFAULT 'color',
  ADD COLUMN IF NOT EXISTS bg_image_url text,
  ADD COLUMN IF NOT EXISTS bg_image_fit text NOT NULL DEFAULT 'cover';