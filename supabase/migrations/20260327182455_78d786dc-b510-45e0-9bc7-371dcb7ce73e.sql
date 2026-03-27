ALTER TABLE public.screens
ADD COLUMN IF NOT EXISTS player_lan_ip text DEFAULT NULL;