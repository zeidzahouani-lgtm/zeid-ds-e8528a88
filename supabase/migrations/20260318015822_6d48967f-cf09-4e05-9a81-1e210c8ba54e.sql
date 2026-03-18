-- Fix layout deletion: add ON DELETE CASCADE for layout_regions and SET NULL for screens

ALTER TABLE public.layout_regions
  DROP CONSTRAINT layout_regions_layout_id_fkey;

ALTER TABLE public.layout_regions
  ADD CONSTRAINT layout_regions_layout_id_fkey
  FOREIGN KEY (layout_id) REFERENCES public.layouts(id) ON DELETE CASCADE;

ALTER TABLE public.screens
  DROP CONSTRAINT screens_layout_id_fkey;

ALTER TABLE public.screens
  ADD CONSTRAINT screens_layout_id_fkey
  FOREIGN KEY (layout_id) REFERENCES public.layouts(id) ON DELETE SET NULL;