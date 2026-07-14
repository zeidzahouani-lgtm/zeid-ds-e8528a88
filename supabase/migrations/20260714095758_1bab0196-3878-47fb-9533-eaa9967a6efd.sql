-- Restore anon SELECT on screens with column whitelist (excluding sensitive fields).
-- Also restore anon UPDATE on runtime columns needed by the player.
GRANT SELECT (
  id, name, orientation, status, current_media_id, created_at, updated_at,
  establishment_id, layout_id, slug, player_session_id, player_heartbeat_at,
  playlist_id, program_id, debug_mode, fallback_since, fallback_notified,
  resolution, wall_id, wall_row, wall_col, show_name, os_type, pending_action
) ON public.screens TO anon;

GRANT UPDATE (
  status, current_media_id, player_session_id, player_heartbeat_at,
  player_user_agent, player_ip, player_lan_ip, fallback_since, fallback_notified,
  os_type, ip_address, pending_action, updated_at
) ON public.screens TO anon;

-- Authenticated users should always have full table access (RLS enforces scope).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screens TO authenticated;
GRANT ALL ON public.screens TO service_role;