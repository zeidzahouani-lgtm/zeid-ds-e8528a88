ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS allow_multi_session boolean NOT NULL DEFAULT false;

GRANT SELECT (allow_multi_session) ON public.screens TO anon;

CREATE OR REPLACE FUNCTION public.screens_anon_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_role text;
BEGIN
  BEGIN
    v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  EXCEPTION WHEN OTHERS THEN v_role := NULL;
  END;
  IF v_role IS DISTINCT FROM 'anon' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.allow_multi_session, false) THEN RETURN NEW; END IF;
  IF OLD.player_session_id IS NOT NULL
     AND OLD.player_heartbeat_at IS NOT NULL
     AND OLD.player_heartbeat_at > now() - interval '20 seconds'
     AND OLD.player_session_id IS DISTINCT FROM NEW.player_session_id THEN
    RAISE EXCEPTION 'screen is locked by an active player session';
  END IF;
  RETURN NEW;
END; $function$;

DROP FUNCTION IF EXISTS public.resolve_player_screen(text);

CREATE OR REPLACE FUNCTION public.resolve_player_screen(_screen_key text)
 RETURNS TABLE(id uuid, name text, orientation text, status text, current_media_id uuid, layout_id uuid, playlist_id uuid, program_id uuid, show_name boolean, debug_mode smallint, resolution text, wall_id uuid, wall_row integer, wall_col integer, player_session_id text, player_heartbeat_at timestamp with time zone, pending_action text, establishment_id uuid, allow_multi_session boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    s.establishment_id,
    s.allow_multi_session
  FROM public.screens s
  WHERE s.slug = trim(_screen_key)
     OR s.id::text = trim(_screen_key)
  ORDER BY CASE WHEN s.slug = trim(_screen_key) THEN 0 ELSE 1 END
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.resolve_player_screen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_player_screen(text) TO anon, authenticated, service_role;