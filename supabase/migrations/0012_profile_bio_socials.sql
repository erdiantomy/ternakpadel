-- ============================================================================
-- Player profile: bio + Instagram handle + linked reclub profile URL.
-- Exposed (non-PII) via profiles_public so other players can see them.
-- Safe to run more than once.
-- ============================================================================
alter table public.profiles add column if not exists bio        text not null default '';
alter table public.profiles add column if not exists instagram  text;
alter table public.profiles add column if not exists reclub_url text;

-- refresh the public view to include the new public fields (no phone)
create or replace view public.profiles_public
  with (security_invoker = false) as
  select id, username, full_name, skill, side, city, is_host, is_admin, created_at,
         bio, instagram, reclub_url
  from public.profiles;
grant select on public.profiles_public to anon, authenticated;
