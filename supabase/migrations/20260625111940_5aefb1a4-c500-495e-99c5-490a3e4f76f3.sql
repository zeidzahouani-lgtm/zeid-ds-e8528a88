ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS os_type TEXT CHECK (os_type IN ('webos','tizen','android')),
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS pending_action TEXT CHECK (pending_action IN ('reboot','shutdown'));