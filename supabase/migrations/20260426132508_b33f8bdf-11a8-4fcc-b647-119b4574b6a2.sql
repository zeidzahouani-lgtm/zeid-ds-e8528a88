-- Create default global admin account for dashboard access after deployment
DO $$
DECLARE
  new_user_id uuid;
  existing_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO existing_id FROM auth.users WHERE email = 'screenflow@screenflow.local' LIMIT 1;

  IF existing_id IS NULL THEN
    new_user_id := gen_random_uuid();

    -- Insert into auth.users with bcrypt-hashed password for "260390DS"
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'screenflow@screenflow.local',
      crypt('260390DS', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"ScreenFlow Admin"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Insert auth identity
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', 'screenflow@screenflow.local', 'email_verified', true),
      'email',
      new_user_id::text,
      now(),
      now(),
      now()
    );

    -- Promote to global admin (overrides default 'user' role from handle_new_user trigger)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'admin')
    ON CONFLICT DO NOTHING;

    -- Remove default 'user' role if it was added by trigger
    DELETE FROM public.user_roles WHERE user_id = new_user_id AND role = 'user';
  END IF;
END $$;