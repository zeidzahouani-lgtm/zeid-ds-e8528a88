
ALTER TABLE public.email_mailboxes
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS oauth_tenant_id text,
  ADD COLUMN IF NOT EXISTS oauth_client_id text,
  ADD COLUMN IF NOT EXISTS oauth_client_secret text,
  ADD COLUMN IF NOT EXISTS provider text;
