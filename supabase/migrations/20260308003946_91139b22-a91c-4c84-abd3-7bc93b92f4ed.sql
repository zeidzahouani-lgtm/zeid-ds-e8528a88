
-- Allow admins to read all profiles (for admin panel)
CREATE POLICY "Admins can read all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all screens (for assignment)
CREATE POLICY "Admins can read all screens" ON public.screens
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all screens (for assignment)
CREATE POLICY "Admins can update all screens" ON public.screens
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all user_roles
CREATE POLICY "Admins can read all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
