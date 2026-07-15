
CREATE TABLE public.player_readiness_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  http_status integer,
  checks_ok integer NOT NULL DEFAULT 0,
  checks_total integer NOT NULL DEFAULT 0,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_player_readiness_history_created_at ON public.player_readiness_history (created_at DESC);

GRANT SELECT ON public.player_readiness_history TO authenticated;
GRANT ALL ON public.player_readiness_history TO service_role;

ALTER TABLE public.player_readiness_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read readiness history"
  ON public.player_readiness_history
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-purge des vieux enregistrements (> 7 jours) pour éviter la croissance illimitée.
CREATE OR REPLACE FUNCTION public.purge_old_readiness_history()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.player_readiness_history
  WHERE created_at < now() - interval '7 days';
$$;
