
CREATE TABLE public.inbox_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  from_email text NOT NULL,
  from_name text,
  subject text,
  body_preview text,
  has_attachments boolean DEFAULT false,
  attachment_count integer DEFAULT 0,
  attachment_urls text[] DEFAULT '{}',
  is_processed boolean DEFAULT false,
  content_id uuid REFERENCES public.contents(id) ON DELETE SET NULL,
  raw_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inbox_emails" ON public.inbox_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update inbox_emails" ON public.inbox_emails FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete inbox_emails" ON public.inbox_emails FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service can insert inbox_emails" ON public.inbox_emails FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_emails;
