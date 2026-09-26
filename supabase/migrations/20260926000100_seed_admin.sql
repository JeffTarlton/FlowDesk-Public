-- =============================================================================
-- FlowDesk default admin account
-- =============================================================================
-- Creates the one account you need to get started:
--
--     Email:    admin@flowdesk.com   (sign-in is not case sensitive)
--     Password: Password2026!
--
-- Run it after 20260926000000_flowdesk_schema.sql (supabase db push and
-- supabase start apply both files in order; in the SQL Editor paste this file
-- second). It creates no other users. Sign in as this admin and add your team
-- from Admin -> Users -> Invite User.
--
-- CHANGE THE PASSWORD. This password is published with the source code, so the
-- account is flagged to change it on first sign-in: FlowDesk shows a
-- "Set Your Password" screen before anything else. That screen calls the
-- admin-actions edge function, so deploy the function BEFORE the first
-- sign-in (supabase functions deploy admin-actions).
--
-- Safe to re-run: if admin@flowdesk.com already exists, nothing about it is
-- changed (a missing profile row is recreated as an active admin).
--
-- Locked out? Run this in the SQL Editor to reset the password to the default,
-- re-enable the account and make it an admin again (you will be asked to pick
-- a new password at the next sign-in):
--
--   UPDATE auth.users
--      SET encrypted_password = extensions.crypt('Password2026!', extensions.gen_salt('bf')),
--          updated_at = now()
--    WHERE email = 'admin@flowdesk.com';
--
--   UPDATE public.profiles
--      SET role = 'admin', is_active = true, force_password_reset = true
--    WHERE email = 'admin@flowdesk.com';
--
-- The same two statements work for any other user: change the email, and use
-- a temporary password of your own instead of the default.
-- =============================================================================

DO $$
DECLARE
  v_email   constant text := 'admin@flowdesk.com';
  v_user_id uuid;
BEGIN
  SELECT u.id INTO v_user_id
  FROM auth.users AS u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    -- The token columns must be '' rather than NULL, or Supabase Auth fails to
    -- load the user at sign-in.
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt('Password2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "FlowDesk Admin"}'::jsonb,
      now(),
      now(),
      '', '', '', ''
    );

    -- Email/password sign-in also needs an identity row.
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      'email',
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      now(),
      now(),
      now()
    );

    -- handle_new_user has just created the profile as an inactive 'customer';
    -- promote it. The upsert also covers a missing profile row.
    INSERT INTO public.profiles (id, email, full_name, role, is_active, force_password_reset)
    VALUES (v_user_id, v_email, 'FlowDesk Admin', 'admin', true, true)
    ON CONFLICT (id) DO UPDATE
      SET email                = EXCLUDED.email,
          full_name            = EXCLUDED.full_name,
          role                 = EXCLUDED.role,
          is_active            = EXCLUDED.is_active,
          force_password_reset = EXCLUDED.force_password_reset;

    RAISE NOTICE 'Created the default admin %. Change its password at first sign-in.', v_email;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role, is_active, force_password_reset)
    VALUES (v_user_id, v_email, 'FlowDesk Admin', 'admin', true, true)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'The admin % already exists; it was left unchanged.', v_email;
  END IF;
END
$$;
