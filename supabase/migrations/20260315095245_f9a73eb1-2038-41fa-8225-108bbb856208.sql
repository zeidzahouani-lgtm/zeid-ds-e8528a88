
-- Add extra columns to establishments
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS max_screens integer NOT NULL DEFAULT 0;
