CREATE OR REPLACE FUNCTION public.mark_screen_configuration_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.pending_action IS DISTINCT FROM OLD.pending_action THEN
    RETURN NEW;
  END IF;

  IF ROW(
    NEW.name,
    NEW.orientation,
    NEW.layout_id,
    NEW.playlist_id,
    NEW.program_id,
    NEW.resolution,
    NEW.wall_id,
    NEW.wall_row,
    NEW.wall_col,
    NEW.show_name,
    NEW.debug_mode
  ) IS DISTINCT FROM ROW(
    OLD.name,
    OLD.orientation,
    OLD.layout_id,
    OLD.playlist_id,
    OLD.program_id,
    OLD.resolution,
    OLD.wall_id,
    OLD.wall_row,
    OLD.wall_col,
    OLD.show_name,
    OLD.debug_mode
  ) THEN
    NEW.pending_action := 'resync';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_screen_configuration_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_screen_configuration_pending() TO service_role;