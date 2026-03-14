ALTER TABLE public.screens
DROP CONSTRAINT IF EXISTS screens_orientation_check;

ALTER TABLE public.screens
ADD CONSTRAINT screens_orientation_check
CHECK (
  orientation = ANY (
    ARRAY['landscape'::text, 'portrait'::text, 'landscape-flipped'::text, 'portrait-flipped'::text]
  )
);