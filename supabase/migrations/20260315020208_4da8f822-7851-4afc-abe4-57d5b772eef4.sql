
-- Create content status enum
CREATE TYPE public.content_status AS ENUM ('pending', 'scheduled', 'active', 'rejected');

-- Create contents table
CREATE TABLE public.contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  screen_id uuid REFERENCES public.screens(id) ON DELETE SET NULL,
  status content_status NOT NULL DEFAULT 'pending',
  title text,
  source text DEFAULT 'webhook',
  user_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read contents" ON public.contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contents" ON public.contents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contents" ON public.contents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete contents" ON public.contents FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon can read active contents for player" ON public.contents FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "Anon can insert via webhook" ON public.contents FOR INSERT TO anon WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contents;

-- Updated_at trigger
CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON public.contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
