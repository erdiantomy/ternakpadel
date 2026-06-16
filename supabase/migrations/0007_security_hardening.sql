-- ============================================================================
-- Security hardening — payment integrity + customer-data exposure.
--
-- Closes holes found in the security audit. These tables (payment_orders,
-- wallet_transactions, donations, venue_registrations, padel_players) belong to
-- the credits/wallet build that shares this project; payment_orders / wallet /
-- donations / venue_registrations are empty, so tightening them breaks nothing.
-- Safe to run more than once.
-- ============================================================================

-- C1 — payment_orders: "service role update orders" was FOR UPDATE TO public
-- USING(true) — i.e. ANY user could mark any order paid. The real service role
-- bypasses RLS, so this policy only ever granted the exploit. Drop it.
drop policy if exists "service role update orders" on public.payment_orders;

-- C2 — wallet_transactions: clients could insert their own ledger rows with
-- arbitrary credit/SP amounts (self top-up). Ledger writes belong to the
-- payment webhook (service role, bypasses RLS). Drop the client INSERT policy.
drop policy if exists "Users can insert their own transactions" on public.wallet_transactions;

-- C4 — donations: INSERT WITH CHECK(true) let a user forge a paid donation and
-- spoof the donor. Force pending + positive amount + donor ownership; the
-- webhook flips status to paid.
drop policy if exists "Authenticated users can donate" on public.donations;
create policy "Authenticated users can donate" on public.donations for insert to authenticated
  with check (
    status = 'pending'
    and amount > 0
    and (donor_id is null
         or donor_id in (select id from public.padel_players where user_id = auth.uid()))
  );

-- C5 — venue_registrations: was world-readable (TO public USING true) and stores
-- admin_password in plaintext plus contact email/phone. Restrict reads to
-- admins. (Public INSERT for the registration form is left in place.)
drop policy if exists "public read registrations" on public.venue_registrations;
create policy "admins read registrations" on public.venue_registrations for select to authenticated
  using (public.is_admin());

-- C3 — padel_players: "Players update own" had no column guard, so a player
-- could set their own credits / xp / wins / division. Pin the game + wallet
-- columns to their current values (legit changes flow through SECURITY DEFINER
-- functions / the service role, which bypass RLS). Cosmetic fields stay editable.
drop policy if exists "Players update own" on public.padel_players;
create policy "Players update own" on public.padel_players for update to public
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and credits     = (select p.credits     from public.padel_players p where p.id = padel_players.id)
    and lifetime_xp = (select p.lifetime_xp from public.padel_players p where p.id = padel_players.id)
    and monthly_pts = (select p.monthly_pts from public.padel_players p where p.id = padel_players.id)
    and wins        = (select p.wins        from public.padel_players p where p.id = padel_players.id)
    and losses      = (select p.losses      from public.padel_players p where p.id = padel_players.id)
    and streak      = (select p.streak      from public.padel_players p where p.id = padel_players.id)
    and division    = (select p.division    from public.padel_players p where p.id = padel_players.id)
  );

-- H1 — padel_players is world-readable and exposes email. Stop anonymous
-- (logged-out) harvesting of customer emails by revoking the email column from
-- the anon role. Authenticated reads still work; recommend a name-only view for
-- that app to fully close it.
revoke select (email) on public.padel_players from anon;

-- H2 (prep) — safe public-profile view for the live padel app. Exposes only
-- non-PII columns (NO phone). The app's cross-user name lookup will use this so
-- the base profiles table can later be locked to self + admin without breaking
-- name display across feed / standings / rosters.
create or replace view public.profiles_public
  with (security_invoker = false) as
  select id, username, full_name, skill, side, city, is_host, is_admin, created_at
  from public.profiles;
grant select on public.profiles_public to anon, authenticated;
