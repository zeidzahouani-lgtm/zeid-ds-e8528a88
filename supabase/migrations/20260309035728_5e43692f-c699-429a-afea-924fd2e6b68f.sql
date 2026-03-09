-- Add slug column to screens for URL-friendly player URLs
ALTER TABLE public.screens ADD COLUMN slug text;

-- Create unique index on slug (allows null for backward compat)
CREATE UNIQUE INDEX screens_slug_unique ON public.screens(slug) WHERE slug IS NOT NULL;

-- Generate slugs for existing screens from name
UPDATE public.screens 
SET slug = lower(regexp_replace(
  regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), -- remove special chars except spaces/hyphens
  '\s+', '-', 'g' -- replace spaces with hyphens
));

-- Create function to auto-generate slug from name
CREATE OR REPLACE FUNCTION public.generate_screen_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(
      regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug on insert
CREATE TRIGGER screens_generate_slug
BEFORE INSERT ON public.screens
FOR EACH ROW
EXECUTE FUNCTION public.generate_screen_slug();