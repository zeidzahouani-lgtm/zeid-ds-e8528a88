CREATE TABLE public.email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.contents(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  actor_email text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_actions" ON public.email_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert email_actions" ON public.email_actions FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.email_actions;