-- ============================================================================
-- Event import provenance: lets the reclub link-importer dedupe / sync events.
-- source_ref is unique (NULLs are distinct, so manual events are unaffected) so
-- re-importing the same reclub event upserts instead of duplicating.
-- Safe to run more than once.
-- ============================================================================
alter table public.events add column if not exists source     text;
alter table public.events add column if not exists source_url  text;
alter table public.events add column if not exists source_ref  text;
create unique index if not exists events_source_ref_key on public.events (source_ref);
