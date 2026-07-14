
CREATE TABLE public.player_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_key TEXT NOT NULL,
  screen_id UUID NULL REFERENCES public.screens(id) ON DELETE SET NULL,
  establishment_id UUID NULL REFERENCES public.establishments(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  message TEXT NULL,
  url TEXT NULL,
  user_agent TEXT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX player_errors_created_at_idx ON public.player_errors (created_at DESC);
CREATE INDEX player_errors_screen_id_idx ON public.player_errors (screen_id);
CREATE INDEX player_errors_establishment_idx ON public.player_errors (establishment_id);

GRANT SELECT ON public.player_errors TO authenticated;
GRANT ALL ON public.player_errors TO service_role;

ALTER TABLE public.player_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see all player errors"
  ON public.player_errors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members see their establishment player errors"
  ON public.player_errors FOR SELECT TO authenticated
  USING (
    establishment_id IS NOT NULL
    AND public.is_member_of(auth.uid(), establishment_id)
  );

CREATE POLICY "Admins can mark resolved"
  ON public.player_errors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_player_error(
  _screen_key TEXT,
  _error_type TEXT,
  _message TEXT DEFAULT NULL,
  _url TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screen_id UUID;
  v_screen_name TEXT;
  v_est_id UUID;
  v_recent UUID;
  v_new_id UUID;
  v_type TEXT;
BEGIN
  v_type := COALESCE(NULLIF(trim(_error_type), ''), 'unknown');

  IF _screen_key IS NULL OR length(trim(_screen_key)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT s.id, s.name, s.establishment_id
    INTO v_screen_id, v_screen_name, v_est_id
  FROM public.screens s
  WHERE s.slug = trim(_screen_key) OR s.id::text = trim(_screen_key)
  ORDER BY CASE WHEN s.slug = trim(_screen_key) THEN 0 ELSE 1 END
  LIMIT 1;

  -- Dédoublonnage : ignorer si même clé + même type dans les 5 dernières minutes
  SELECT id INTO v_recent
  FROM public.player_errors
  WHERE screen_key = trim(_screen_key)
    AND error_type = v_type
    AND created_at > now() - interval '5 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent IS NOT NULL THEN
    RETURN v_recent;
  END IF;

  INSERT INTO public.player_errors (screen_key, screen_id, establishment_id, error_type, message, url, user_agent)
  VALUES (trim(_screen_key), v_screen_id, v_est_id, v_type, _message, _url, _user_agent)
  RETURNING id INTO v_new_id;

  -- Notification pour l'établissement quand connu
  IF v_est_id IS NOT NULL THEN
    INSERT INTO public.notifications (establishment_id, screen_id, type, title, message)
    VALUES (
      v_est_id,
      v_screen_id,
      'player_error',
      CASE v_type
        WHEN 'screen_not_found' THEN 'Écran introuvable'
        WHEN 'media_missing' THEN 'Média manquant'
        WHEN 'url_invalid' THEN 'URL du player invalide'
        WHEN 'load_error' THEN 'Erreur de chargement du player'
        ELSE 'Erreur player'
      END,
      COALESCE(
        'Écran « ' || COALESCE(v_screen_name, trim(_screen_key)) || ' » : ' || COALESCE(_message, v_type),
        v_type
      )
    );
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_player_error(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_player_error(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
