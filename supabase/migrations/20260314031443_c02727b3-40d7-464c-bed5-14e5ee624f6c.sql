ALTER TABLE public.screens
ADD COLUMN IF NOT EXISTS player_session_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS player_heartbeat_at timestamptz DEFAULT NULL;