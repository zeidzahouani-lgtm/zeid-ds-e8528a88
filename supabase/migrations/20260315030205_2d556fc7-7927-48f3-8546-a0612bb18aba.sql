CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active access_codes" ON public.access_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage access_codes" ON public.access_codes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Create uploads bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

-- Storage policies for uploads bucket
CREATE POLICY "Anyone can upload to uploads bucket" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Anyone can read uploads" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'uploads');