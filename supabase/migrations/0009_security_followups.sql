-- ============================================================================
-- Security follow-ups (#1–#4 from the audit). Touches the shared credits/wallet
-- + sessions apps. Safe to run more than once.
-- ============================================================================

-- helpers ---------------------------------------------------------------------
create or replace function public.owns_padel(p_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.padel_players where id = p_id and user_id = auth.uid());
$$;

create or replace function public.is_session_host(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.sessions s
    join public.padel_players pp on pp.id = s.host_id
    where s.id = p_session and pp.user_id = auth.uid()
  );
$$;

-- ===========================================================================
-- #1 — venue_registrations: stop storing admin_password in plaintext.
-- A BEFORE trigger bcrypt-hashes it transparently; verify via verify_venue_admin
-- (so the venue admin login never needs to read the hash).
-- ===========================================================================
create extension if not exists pgcrypto with schema extensions;

create or replace function public.hash_venue_admin_password()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.admin_password is not null and new.admin_password not like '$2%' then
    new.admin_password := extensions.crypt(new.admin_password, extensions.gen_salt('bf'));
  end if;
  return new;
end $$;

drop trigger if exists trg_hash_venue_admin_password on public.venue_registrations;
create trigger trg_hash_venue_admin_password
  before insert or update of admin_password on public.venue_registrations
  for each row execute function public.hash_venue_admin_password();

-- hash any pre-existing plaintext (none today, but idempotent)
update public.venue_registrations
  set admin_password = extensions.crypt(admin_password, extensions.gen_salt('bf'))
  where admin_password is not null and admin_password not like '$2%';

create or replace function public.verify_venue_admin(p_slug text, p_password text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.venue_registrations
    where slug = p_slug and admin_password = extensions.crypt(p_password, admin_password)
  );
$$;
revoke all on function public.verify_venue_admin(text, text) from public;
grant execute on function public.verify_venue_admin(text, text) to anon, authenticated;

-- ===========================================================================
-- #2 — sessions / session_players / session_supports / score_submissions:
-- replace "any authenticated user can write any row" with owner/host scoping.
-- All *_id owner columns reference padel_players.id (user via padel_players.user_id).
-- ===========================================================================

-- sessions: only the host (or admin) creates/updates a session
drop policy if exists "Sessions insert by auth" on public.sessions;
create policy "Sessions insert by host" on public.sessions for insert to authenticated
  with check (public.owns_padel(host_id));
drop policy if exists "Sessions update by host" on public.sessions;
create policy "Sessions update by host" on public.sessions for update to authenticated
  using (public.owns_padel(host_id) or public.is_admin())
  with check (public.owns_padel(host_id) or public.is_admin());

-- session_players: you add yourself, or the session host/admin manages the roster
drop policy if exists "Session players insert by auth" on public.session_players;
create policy "Session players insert" on public.session_players for insert to authenticated
  with check (public.owns_padel(player_id) or public.is_session_host(session_id) or public.is_admin());
drop policy if exists "Session players update by auth" on public.session_players;
create policy "Session players update" on public.session_players for update to authenticated
  using (public.owns_padel(player_id) or public.is_session_host(session_id) or public.is_admin())
  with check (public.owns_padel(player_id) or public.is_session_host(session_id) or public.is_admin());

-- session_supports (money): you may only create your OWN support, with no payout
-- set; payouts are resolved server-side (resolve_support_payouts / service role),
-- so there is no client UPDATE policy.
drop policy if exists "Supports insert by auth" on public.session_supports;
create policy "Supports insert own" on public.session_supports for insert to authenticated
  with check (public.owns_padel(supporter_id) and amount > 0 and coalesce(payout,0) = 0 and resolved = false);
drop policy if exists "Supports update by auth" on public.session_supports;
-- (no replacement: clients cannot mutate supports/payouts)

-- score_submissions: a player reports a score as themselves (pending, not pre-
-- credited); only the session host or an admin may approve/update it.
drop policy if exists "Scores insert by auth" on public.score_submissions;
create policy "Scores insert own" on public.score_submissions for insert to authenticated
  with check (public.owns_padel(reported_by) and status = 'pending' and xp_credited = false);
drop policy if exists "Scores update by auth" on public.score_submissions;
create policy "Scores update by host" on public.score_submissions for update to authenticated
  using (public.is_session_host(session_id) or public.is_admin())
  with check (public.is_session_host(session_id) or public.is_admin());

-- ===========================================================================
-- #3 — SECURITY DEFINER views that bypass RLS. Switch the safe ones to
-- security_invoker so the caller's RLS (and player_profiles.is_public) applies.
-- event_standings intentionally stays definer: it reads the now-locked-down
-- profiles table and only exposes full_name / username / pts (no PII).
-- ===========================================================================
alter view public.lifetime_leaderboard  set (security_invoker = true);
alter view public.monthly_leaderboard    set (security_invoker = true);
alter view public.player_match_history   set (security_invoker = true);
alter view public.player_profile_full    set (security_invoker = true);

-- ===========================================================================
-- #4 — SECURITY DEFINER functions callable by anon/authenticated with no caller
-- check. award_match and credit_xp_for_score grant points / approve scores / mint
-- XP for arbitrary rows — lock them to the service role (they are invoked
-- internally by end_round, which runs as definer and self-authorizes).
-- end_round and finish_match already verify the caller; just drop anon there.
-- ===========================================================================
revoke execute on function public.award_match(uuid, uuid)        from public, anon, authenticated;
grant  execute on function public.award_match(uuid, uuid)        to service_role;
revoke execute on function public.credit_xp_for_score(uuid)      from public, anon, authenticated;
grant  execute on function public.credit_xp_for_score(uuid)      to service_role;
revoke execute on function public.end_round(uuid, integer)       from public, anon;
revoke execute on function public.finish_match(uuid)             from anon;
