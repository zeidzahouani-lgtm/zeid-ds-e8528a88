
-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Create user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to screens, media, playlist_items, schedules for multi-tenancy
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for screens to be user-scoped
DROP POLICY IF EXISTS "Anyone can read screens" ON public.screens;
DROP POLICY IF EXISTS "Anyone can insert screens" ON public.screens;
DROP POLICY IF EXISTS "Anyone can update screens" ON public.screens;
DROP POLICY IF EXISTS "Anyone can delete screens" ON public.screens;

CREATE POLICY "Users can read own screens" ON public.screens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own screens" ON public.screens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own screens" ON public.screens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own screens" ON public.screens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update RLS policies for media
DROP POLICY IF EXISTS "Anyone can read media" ON public.media;
DROP POLICY IF EXISTS "Anyone can insert media" ON public.media;
DROP POLICY IF EXISTS "Anyone can update media" ON public.media;
DROP POLICY IF EXISTS "Anyone can delete media" ON public.media;

CREATE POLICY "Users can read own media" ON public.media FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own media" ON public.media FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own media" ON public.media FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own media" ON public.media FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Keep playlist_items and schedules accessible via screen ownership (they reference screen_id)
DROP POLICY IF EXISTS "Anyone can read playlist_items" ON public.playlist_items;
DROP POLICY IF EXISTS "Anyone can insert playlist_items" ON public.playlist_items;
DROP POLICY IF EXISTS "Anyone can update playlist_items" ON public.playlist_items;
DROP POLICY IF EXISTS "Anyone can delete playlist_items" ON public.playlist_items;

CREATE POLICY "Users can read own playlist_items" ON public.playlist_items FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = playlist_items.screen_id AND screens.user_id = auth.uid()));
CREATE POLICY "Users can insert own playlist_items" ON public.playlist_items FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = playlist_items.screen_id AND screens.user_id = auth.uid()));
CREATE POLICY "Users can update own playlist_items" ON public.playlist_items FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = playlist_items.screen_id AND screens.user_id = auth.uid()));
CREATE POLICY "Users can delete own playlist_items" ON public.playlist_items FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = playlist_items.screen_id AND screens.user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can read schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can insert schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can update schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can delete schedules" ON public.schedules;

CREATE POLICY "Users can read own schedules" ON public.schedules FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = schedules.screen_id AND screens.user_id = auth.uid()));
CREATE POLICY "Users can insert own schedules" ON public.schedules FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = schedules.screen_id AND screens.user_id = auth.uid()));
CREATE POLICY "Users can update own schedules" ON public.schedules FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = schedules.screen_id AND screens.user_id = auth.uid()));
CREATE POLICY "Users can delete own schedules" ON public.schedules FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.screens WHERE screens.id = schedules.screen_id AND screens.user_id = auth.uid()));

-- Allow anonymous read on screens for the player (unauthenticated access)
CREATE POLICY "Anyone can read screens for player" ON public.screens FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update screen status" ON public.screens FOR UPDATE TO anon USING (true);

-- Allow anon to read media for player
CREATE POLICY "Anyone can read media for player" ON public.media FOR SELECT TO anon USING (true);

-- Allow anon to read playlist_items for player
CREATE POLICY "Anyone can read playlist_items for player" ON public.playlist_items FOR SELECT TO anon USING (true);

-- Allow anon to read schedules for player
CREATE POLICY "Anyone can read schedules for player" ON public.schedules FOR SELECT TO anon USING (true);
