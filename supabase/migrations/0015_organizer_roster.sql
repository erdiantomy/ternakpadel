-- ============================================================================
-- Let the event organizer (created_by) fully manage their own event's roster:
-- add players and mark them paid, so a self-run session counts everyone —
-- no admin and no payment step required. Previously only the player themselves
-- (unpaid) or an admin could touch event_players, so players placed into a
-- generated lineup were missing from rosters / counts until they paid.
-- Safe to run more than once.
-- ============================================================================

drop policy if exists "organizer manages roster" on public.event_players;
create policy "organizer manages roster" on public.event_players for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));
