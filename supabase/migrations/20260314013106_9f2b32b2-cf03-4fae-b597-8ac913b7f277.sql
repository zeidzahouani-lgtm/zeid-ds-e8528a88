
-- App settings table for branding customization
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for login page, player, etc.)
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  TO public
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('app_name', 'SignageOS'),
  ('app_tagline', 'Digital Signage CMS'),
  ('logo_url', ''),
  ('favicon_url', ''),
  ('primary_color', '185 100% 55%'),
  ('accent_color', '270 80% 60%'),
  ('welcome_message', 'Connectez-vous à votre tableau de bord'),
  ('page_title', 'SignageOS — Digital Signage CMS');

-- Licenses table
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  screen_id uuid REFERENCES public.screens(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  valid_from timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Admins can manage all licenses
CREATE POLICY "Admins can manage licenses"
  ON public.licenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read their own screen licenses
CREATE POLICY "Users can read own screen licenses"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (
    screen_id IN (SELECT id FROM public.screens WHERE user_id = auth.uid())
  );

-- Anon can validate a license (for player)
CREATE POLICY "Anyone can read licenses for player"
  ON public.licenses FOR SELECT
  TO anon
  USING (true);
