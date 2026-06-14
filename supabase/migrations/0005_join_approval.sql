-- ============================================================================
-- Join-approval flow for events.
--
-- New lifecycle on event_players.status:
--   requested → (host/admin approves) approved → (player pays) paid
--                \→ (host/admin rejects) rejected
--
-- Only 'paid' rows are participants (counted in the roster / pairings).
-- Only 'approved' rows are allowed to start a payment (enforced in the
-- create-invoice edge function and by RLS below).
--
-- Safe to run more than once.
-- ============================================================================

-- 1. status column ----------------------------------------------------------
alter table public.event_players
  add column if not exists status text not null default 'requested'
  check (status in ('requested','approved','rejected','paid'));

-- backfill existing rows: anyone already paid stays a participant; existing
-- un-paid joiners are grandfathered as approved so they can still pay.
update public.event_players
  set status = case when paid then 'paid' else 'approved' end
  where status = 'requested' and joined_at < now() - interval '1 minute';

-- 2. RLS ---------------------------------------------------------------------
-- (re)create the policies that govern who can write to event_players.
drop policy if exists "join event"        on public.event_players;
drop policy if exists "own row update"     on public.event_players;
drop policy if exists "host or admin approve" on public.event_players;

-- a player may REQUEST to join (status must start as 'requested', never paid)
create policy "request to join" on public.event_players for insert to authenticated
  with check (player_id = auth.uid() and status = 'requested' and paid = false);

-- a player may update only their OWN row, and may NOT escalate status or paid
-- (so they can check in, but cannot self-approve or self-mark-paid). They may,
-- however, withdraw by setting status back to 'requested'… we simply pin both
-- status and paid to their current values here; check-in changes checked_in.
create policy "own row update" on public.event_players for update to authenticated
  using (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and paid   = (select ep.paid   from public.event_players ep
                   where ep.event_id = event_players.event_id and ep.player_id = auth.uid())
    and status = (select ep.status from public.event_players ep
                   where ep.event_id = event_players.event_id and ep.player_id = auth.uid())
  );

-- a player may withdraw their own pending/rejected request
drop policy if exists "withdraw request" on public.event_players;
create policy "withdraw request" on public.event_players for delete to authenticated
  using (player_id = auth.uid() and status in ('requested','rejected'));

-- the event HOST or a superADMIN may approve/reject requests (set status only
-- to approved/rejected — never to paid; that is the payment webhook's job)
create policy "host or admin approve" on public.event_players for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.events e
                where e.id = event_players.event_id and e.created_by = auth.uid())
  )
  with check (status in ('requested','approved','rejected') and paid = false);

-- admins keep full control (unchanged, but re-assert for clarity)
drop policy if exists "admin manage rosters" on public.event_players;
create policy "admin manage rosters" on public.event_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3. helpful index for the host's "pending requests" query -------------------
create index if not exists event_players_status_idx
  on public.event_players (event_id, status);
