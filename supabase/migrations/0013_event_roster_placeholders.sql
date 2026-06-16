-- ============================================================================
-- Placeholder roster for events generated from a reclub link. Stores dummy
-- player slots ([{name, email}]) that an admin can later fulfill with real
-- emails. Separate from event_players (which are real, paid registrations).
-- Safe to run more than once.
-- ============================================================================
alter table public.events add column if not exists roster jsonb not null default '[]'::jsonb;
