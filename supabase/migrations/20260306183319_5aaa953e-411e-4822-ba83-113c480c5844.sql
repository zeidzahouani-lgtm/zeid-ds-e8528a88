
-- Create media table
CREATE TABLE public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'iframe')),
  url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create screens table
CREATE TABLE public.screens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  current_media_id UUID REFERENCES public.media(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_items table for ordering media per screen
CREATE TABLE public.playlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- Public read policies (signage system - screens need to read)
CREATE POLICY "Anyone can read media" ON public.media FOR SELECT USING (true);
CREATE POLICY "Anyone can insert media" ON public.media FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update media" ON public.media FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete media" ON public.media FOR DELETE USING (true);

CREATE POLICY "Anyone can read screens" ON public.screens FOR SELECT USING (true);
CREATE POLICY "Anyone can insert screens" ON public.screens FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update screens" ON public.screens FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete screens" ON public.screens FOR DELETE USING (true);

CREATE POLICY "Anyone can read playlist_items" ON public.playlist_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert playlist_items" ON public.playlist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update playlist_items" ON public.playlist_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete playlist_items" ON public.playlist_items FOR DELETE USING (true);

-- Enable realtime for screens table
ALTER PUBLICATION supabase_realtime ADD TABLE public.screens;

-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

CREATE POLICY "Anyone can read media files" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Anyone can upload media files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
CREATE POLICY "Anyone can delete media files" ON storage.objects FOR DELETE USING (bucket_id = 'media');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_screens_updated_at
  BEFORE UPDATE ON public.screens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
