ALTER TABLE public.layouts 
  ADD COLUMN IF NOT EXISTS bg_overlay_darken integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bg_overlay_blur integer NOT NULL DEFAULT 0;