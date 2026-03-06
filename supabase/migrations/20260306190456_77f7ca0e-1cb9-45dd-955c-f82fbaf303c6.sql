
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  media_id uuid REFERENCES public.media(id) ON DELETE CASCADE,
  start_time time NOT NULL DEFAULT '00:00',
  end_time time NOT NULL DEFAULT '23:59',
  days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert schedules" ON public.schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update schedules" ON public.schedules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete schedules" ON public.schedules FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
