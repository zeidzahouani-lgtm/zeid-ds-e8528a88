
-- 1) Allow anon to read establishments (for player logo display)
CREATE POLICY "Anon can read establishments for player"
ON public.establishments
FOR SELECT
TO anon
USING (true);

-- 2) Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  screen_id uuid REFERENCES public.screens(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'screen_offline',
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Members can read their establishment notifications
CREATE POLICY "Members can read establishment notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (is_member_of(auth.uid(), establishment_id));

-- Members can update (mark as read) their establishment notifications
CREATE POLICY "Members can update establishment notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (is_member_of(auth.uid(), establishment_id));

-- Global admins full access
CREATE POLICY "Admins full access notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service/system to insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3) Function to auto-create notification when screen goes offline
CREATE OR REPLACE FUNCTION public.notify_screen_offline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status changes TO 'offline' and screen has an establishment
  IF NEW.status = 'offline' AND OLD.status = 'online' AND NEW.establishment_id IS NOT NULL THEN
    INSERT INTO public.notifications (establishment_id, screen_id, type, title, message)
    VALUES (
      NEW.establishment_id,
      NEW.id,
      'screen_offline',
      'Écran hors ligne',
      'L''écran "' || NEW.name || '" est passé hors ligne.'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_screen_offline_notification
AFTER UPDATE OF status ON public.screens
FOR EACH ROW
EXECUTE FUNCTION public.notify_screen_offline();
