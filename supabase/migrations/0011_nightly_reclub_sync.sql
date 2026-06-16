-- ============================================================================
-- Nightly auto-sync for reclub-imported events (option B). Fully self-contained:
-- pg_cron fires a DB function that calls the sync-reclub-all edge function via
-- pg_net, authorized by a secret stored in app_config (locked to service role).
-- Safe to run more than once.
-- ============================================================================

-- secret store — RLS-locked + privileges revoked, so only the service role
-- (the edge function) can read it; clients cannot.
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
insert into public.app_config (key, value)
  values ('cron_secret', gen_random_uuid()::text)
  on conflict (key) do nothing;

-- DB → edge function trigger (reads the secret, POSTs via pg_net)
create or replace function public.trigger_reclub_sync()
returns void language plpgsql security definer set search_path = public as $$
declare s text;
begin
  select value into s from public.app_config where key = 'cron_secret';
  perform net.http_post(
    url     := 'https://qsgwtjcrgedjbjsbibxr.supabase.co/functions/v1/sync-reclub-all',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;
revoke all on function public.trigger_reclub_sync() from public, anon, authenticated;

-- schedule nightly at 19:00 UTC (02:00 Asia/Jakarta)
do $$ begin perform cron.unschedule('reclub-nightly-sync'); exception when others then null; end $$;
select cron.schedule('reclub-nightly-sync', '0 19 * * *', $$ select public.trigger_reclub_sync() $$);
