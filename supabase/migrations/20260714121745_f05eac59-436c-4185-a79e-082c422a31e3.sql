CREATE OR REPLACE FUNCTION public.resolve_player_screen(_screen_key text)
RETURNS TABLE (
  id uuid,
  name text,
  orientation text,
  status text,
  current_media_id uuid,
  layout_id uuid,
  playlist_id uuid,
  program_id uuid,
  show_name boolean,
  debug_mode smallint,
  resolution text,
  wall_id uuid,
  wall_row integer,
  wall_col integer,
  player_session_id text,
  player_heartbeat_at timestamp with time zone,
  pending_action text,
  establishment_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.orientation,
    s.status,
    s.current_media_id,
    s.layout_id,
    s.playlist_id,
    s.program_id,
    s.show_name,
    s.debug_mode,
    s.resolution,
    s.wall_id,
    s.wall_row,
    s.wall_col,
    s.player_session_id,
    s.player_heartbeat_at,
    s.pending_action,
    s.establishment_id
  FROM public.screens s
  WHERE s.slug = trim(_screen_key)
     OR s.id::text = trim(_screen_key)
  ORDER BY CASE WHEN s.slug = trim(_screen_key) THEN 0 ELSE 1 END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_player_screen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_player_screen(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_player_screen(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_player_screen(text) TO service_role;