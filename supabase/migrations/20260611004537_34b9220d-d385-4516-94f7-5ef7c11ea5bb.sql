
CREATE TABLE public.email_mailboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('imap','pop3')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password TEXT,
  use_tls BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_test_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_mailboxes TO authenticated;
GRANT ALL ON public.email_mailboxes TO service_role;

ALTER TABLE public.email_mailboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mailboxes" ON public.email_mailboxes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_mailboxes_updated_at
  BEFORE UPDATE ON public.email_mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
