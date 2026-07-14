
CREATE TABLE public.player_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid REFERENCES public.screens(id) ON DELETE CASCADE,
  screen_key text,
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  load_ms integer,
  ttfp_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.player_metrics TO authenticated;
GRANT ALL ON public.player_metrics TO service_role;

ALTER TABLE public.player_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all player metrics"
  ON public.player_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read their establishment metrics"
  ON public.player_metrics FOR SELECT
  TO authenticated
  USING (
    establishment_id IS NOT NULL
    AND public.is_member_of(auth.uid(), establishment_id)
  );

CREATE INDEX idx_player_metrics_created_at ON public.player_metrics (created_at DESC);
CREATE INDEX idx_player_metrics_screen ON public.player_metrics (screen_id, created_at DESC);

-- RPC used by anonymous player runtime to record a latency sample.
CREATE OR REPLACE FUNCTION public.log_player_metric(
  _screen_key text,
  _load_ms integer,
  _ttfp_ms integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screen_id uuid;
  v_est uuid;
BEGIN
  IF _load_ms IS NULL OR _load_ms < 0 OR _load_ms > 600000 THEN
    RETURN;
  END IF;

  SELECT id, establishment_id INTO v_screen_id, v_est
  FROM public.screens
  WHERE slug = trim(_screen_key) OR id::text = trim(_screen_key)
  LIMIT 1;

  INSERT INTO public.player_metrics (screen_id, screen_key, establishment_id, load_ms, ttfp_ms)
  VALUES (v_screen_id, _screen_key, v_est, _load_ms, _ttfp_ms);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_player_metric(text, integer, integer) TO anon, authenticated;

-- Health snapshot RPC used by the edge function.
CREATE OR REPLACE FUNCTION public.player_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_errors_5m int;
  v_errors_1h int;
  v_errors_24h int;
  v_errors_by_type jsonb;
  v_avg_load_1h numeric;
  v_p95_load_1h numeric;
  v_samples_1h int;
  v_screens_total int;
  v_screens_online int;
  v_screens_offline int;
  v_status text;
BEGIN
  SELECT count(*) INTO v_errors_5m FROM public.player_errors
    WHERE created_at > v_now - interval '5 minutes' AND resolved = false;
  SELECT count(*) INTO v_errors_1h FROM public.player_errors
    WHERE created_at > v_now - interval '1 hour';
  SELECT count(*) INTO v_errors_24h FROM public.player_errors
    WHERE created_at > v_now - interval '24 hours';

  SELECT COALESCE(jsonb_object_agg(error_type, cnt), '{}'::jsonb) INTO v_errors_by_type
  FROM (
    SELECT error_type, count(*)::int AS cnt
    FROM public.player_errors
    WHERE created_at > v_now - interval '1 hour'
    GROUP BY error_type
  ) t;

  SELECT
    count(*)::int,
    round(avg(load_ms)::numeric, 0),
    round(percentile_cont(0.95) WITHIN GROUP (ORDER BY load_ms)::numeric, 0)
  INTO v_samples_1h, v_avg_load_1h, v_p95_load_1h
  FROM public.player_metrics
  WHERE created_at > v_now - interval '1 hour';

  SELECT count(*)::int INTO v_screens_total FROM public.screens;
  SELECT count(*)::int INTO v_screens_online FROM public.screens
    WHERE status = 'online'
      AND player_heartbeat_at IS NOT NULL
      AND player_heartbeat_at > v_now - interval '10 minutes';
  v_screens_offline := v_screens_total - v_screens_online;

  IF v_errors_5m >= 10 OR (v_screens_total > 0 AND v_screens_online = 0) THEN
    v_status := 'unhealthy';
  ELSIF v_errors_5m >= 3 OR (v_screens_total > 0 AND v_screens_offline::float / v_screens_total > 0.5) THEN
    v_status := 'degraded';
  ELSE
    v_status := 'healthy';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'timestamp', v_now,
    'errors', jsonb_build_object(
      'last_5m', v_errors_5m,
      'last_1h', v_errors_1h,
      'last_24h', v_errors_24h,
      'by_type_1h', v_errors_by_type
    ),
    'latency_1h', jsonb_build_object(
      'samples', COALESCE(v_samples_1h, 0),
      'avg_ms', COALESCE(v_avg_load_1h, 0),
      'p95_ms', COALESCE(v_p95_load_1h, 0)
    ),
    'screens', jsonb_build_object(
      'total', v_screens_total,
      'online', v_screens_online,
      'offline', v_screens_offline
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.player_health_snapshot() TO anon, authenticated;
