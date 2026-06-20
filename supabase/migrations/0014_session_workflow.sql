-- ============================================================================
-- Self-service live sessions — the organizer (event creator / host) runs the
-- whole session without an admin "go live" step.
--   * events.config  jsonb  — per-session format settings (Americano/Mexicano,
--       fixed partner, point vs ranking scoring, rounds, race-to / best-of).
--   * events.status   gains 'paused' (organizer can pause a running session).
--   * matches.order_index — explicit match ordering so the organizer can
--       reorder the schedule (up / down / drag).
--   * matches deletable by the owning host — needed to regenerate a round after
--       an edit (previously only an admin could delete).
-- Safe to run more than once.
-- ============================================================================

alter table public.events  add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.matches add column if not exists order_index int not null default 0;

-- allow the organizer to pause a live session (purely a status label — it does
-- NOT gate scoring or generation)
alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('open','live','paused','done','cancelled'));

-- the owning host may delete matches of their own event (to regenerate a round
-- after editing players / settings). Players still cannot delete.
drop policy if exists "host deletes matches" on public.matches;
create policy "host deletes matches" on public.matches for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));

-- seed ordering for existing matches so reorder has a stable starting point
update public.matches set order_index = court where order_index = 0;
