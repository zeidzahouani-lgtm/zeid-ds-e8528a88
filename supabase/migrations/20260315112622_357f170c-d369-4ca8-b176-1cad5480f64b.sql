
-- Table for registration requests (pending approval)
CREATE TABLE public.registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  establishment_name text NOT NULL,
  num_screens integer NOT NULL DEFAULT 1,
  phone text,
  address text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert a registration request
CREATE POLICY "Anon can submit registration requests"
  ON public.registration_requests FOR INSERT TO anon
  WITH CHECK (true);

-- Admins can do everything
CREATE POLICY "Admins full access registration_requests"
  ON public.registration_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Table for password reset requests (admin-handled)
CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid,
  handled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert a password reset request
CREATE POLICY "Anon can submit password_reset_requests"
  ON public.password_reset_requests FOR INSERT TO anon
  WITH CHECK (true);

-- Admins can do everything
CREATE POLICY "Admins full access password_reset_requests"
  ON public.password_reset_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.password_reset_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registration_requests;
