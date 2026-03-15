
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  generated_code text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- Assign default role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Generate unique access code: first 3 chars of username + 5 random alphanumeric
  generated_code := upper(left(split_part(NEW.email, '@', 1), 3)) || '-' || upper(substr(md5(random()::text), 1, 5));

  INSERT INTO public.access_codes (code, user_name, user_id, is_active)
  VALUES (
    generated_code,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.id,
    true
  );

  RETURN NEW;
END;
$function$;
