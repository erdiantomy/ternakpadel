-- ============================================================================
-- 0006: add Andika as a second superadmin.
--
-- The app normally signs people in passwordless (email magic-link / WhatsApp
-- OTP), but this admin is provisioned with an email + password login so they
-- can reach the admin console directly. The existing owner (biz@tomspadel.com)
-- stays an admin — this is additive.
--
-- Safe to run more than once: re-running just re-asserts the password + grant.
-- ============================================================================

-- crypt()/gen_salt() for the bcrypt password hash live in pgcrypto
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_email text := 'suratnya_andika@yahoo.com';   -- GoTrue stores email lowercased
  v_pass  text := 't0m5padel';
  v_id    uuid;
begin
  -- reuse the account if this email already signed in, otherwise mint one
  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_pass, extensions.gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      '{}'::jsonb
    );
  else
    -- existing user: (re)set the password and make sure the email is confirmed
    update auth.users
       set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  -- email identity so password sign-in can resolve the user
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  )
  on conflict (provider_id, provider) do update
     set identity_data = excluded.identity_data, updated_at = now();

  -- the signup trigger only fires for brand-new GoTrue signups, so upsert here
  insert into public.profiles (id, is_admin)
  values (v_id, true)
  on conflict (id) do update set is_admin = true;
end $$;
