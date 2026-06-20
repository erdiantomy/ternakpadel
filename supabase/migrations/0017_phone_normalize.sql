-- ============================================================================
-- 0017 — Canonical phone normalization (fixes Indonesian-number auto-link).
--
-- 0016 compared phones digits-only, so "08123…" (→ 08123…) and "+62 812-3…"
-- (→ 628123…) never matched. Normalize every phone to ONE canonical form
-- (62XXXXXXXXXX) both before it is stored and before it is compared:
--   * strip spaces / dashes / "+"
--   * leading "0"  -> "62"
--   * bare  "8…"   -> "62…"   (Indonesian mobile typed without the 0)
--   * already "62…"-> kept
--   * foreign numbers (no 0/8/62 lead) kept as-is
-- Additive + idempotent (normalize is a no-op on already-canonical input).
-- ============================================================================

create or replace function public.normalize_phone(p text)
returns text language sql immutable set search_path = public as $$
  with d as (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x)
  select case
    when length(x) < 6      then null
    when left(x, 1) = '0'   then '62' || substr(x, 2)
    when left(x, 2) = '62'  then x
    when left(x, 1) = '8'   then '62' || x
    else x
  end
  from d;
$$;

-- BEFORE trigger usable on any table that has a `phone` column (profiles, players)
create or replace function public.normalize_phone_col()
returns trigger language plpgsql set search_path = public as $$
begin
  new.phone := public.normalize_phone(new.phone);
  return new;
end $$;

drop trigger if exists trg_normalize_profile_phone on public.profiles;
create trigger trg_normalize_profile_phone
  before insert or update of phone on public.profiles
  for each row execute function public.normalize_phone_col();

drop trigger if exists trg_normalize_player_phone on public.players;
create trigger trg_normalize_player_phone
  before insert or update of phone on public.players
  for each row execute function public.normalize_phone_col();

-- backfill existing values to the canonical form (idempotent)
update public.profiles set phone = public.normalize_phone(phone)
  where phone is distinct from public.normalize_phone(phone);
update public.players  set phone = public.normalize_phone(phone)
  where phone is distinct from public.normalize_phone(phone);

-- re-assert the 0016 auto-link, now comparing on the canonical form. (0019
-- upgrades this to merge-into semantics; this keeps the standalone phone fix
-- correct on its own.)
create or replace function public.link_players_by_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.normalize_phone(new.phone) is not null then
    update public.players
      set user_id = new.id
      where user_id is null
        and public.normalize_phone(phone) = public.normalize_phone(new.phone);
  end if;
  return new;
end $$;
