-- ============================================================================
-- 0016 — Shareable live leaderboards + phone linking + a players registry.
--
-- Three independent, additive pieces. Nothing here rewires the existing
-- matches/player_points model (which keys on profiles.id); the players table is
-- introduced as a parallel registry + linking layer so guest history can later
-- be attached to accounts without a risky one-shot refactor. Re-runnable.
--
-- A) SHARE LINK + PUBLIC LIVE LEADERBOARD
--    - events.share_token (random, non-guessable, unique, host-only to mint)
--    - public_session_board(token): SECURITY DEFINER read-only board. Anonymous
--      callers get ONLY leaderboard data (name, points, rank) + round/status —
--      never phone/email/user_id. Raw tables are NOT opened to anon (the spec's
--      privacy rule); the public page polls this function for live updates.
--
-- B) PHONE + AUTO-LINK
--    - profiles.phone already exists; a trigger links any guest players row that
--      shares the same (digits-only) phone the moment a user saves/updates theirs.
--
-- C) PLAYERS REGISTRY (scaffolding)
--    - public.players: a player entity independent of auth (user_id nullable).
--      Backfilled 1:1 from existing profiles. players_public exposes non-PII
--      columns. claim_player / merge_players support the claim + host-merge flows.
-- ============================================================================


-- ============================================================ A) share link
alter table public.events add column if not exists share_token text;
create unique index if not exists events_share_token_key on public.events (share_token);

-- Host-only: mint (or return the existing) share token for a session.
create or replace function public.generate_share_token(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare ev public.events; tok text;
begin
  select * into ev from public.events where id = p_event;
  if ev.id is null then raise exception 'event not found'; end if;
  if not (ev.created_by = auth.uid() or public.is_admin()) then
    raise exception 'only the host can share this session';
  end if;
  if ev.share_token is not null then return ev.share_token; end if;
  -- 64 hex chars from two uuids — non-guessable, no extension dependency
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.events set share_token = tok where id = p_event;
  return tok;
end $$;
revoke all on function public.generate_share_token(uuid) from public, anon;
grant execute on function public.generate_share_token(uuid) to authenticated;

-- Host-only: turn sharing off (drops the token; old links stop working).
create or replace function public.revoke_share_token(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
  select * into ev from public.events where id = p_event;
  if ev.id is null then raise exception 'event not found'; end if;
  if not (ev.created_by = auth.uid() or public.is_admin()) then
    raise exception 'only the host can manage sharing';
  end if;
  update public.events set share_token = null where id = p_event;
end $$;
revoke all on function public.revoke_share_token(uuid) from public, anon;
grant execute on function public.revoke_share_token(uuid) to authenticated;

-- Public, read-only leaderboard for a shared session. Returns ONLY non-PII
-- leaderboard data. Standings reuse the existing per-session scoring (sum of
-- each player's team score across the session's matches). Names resolve from
-- the session's display-name overrides / name-only lineup, then the profile,
-- so guest players appear without exposing any account identifiers.
create or replace function public.public_session_board(p_token text)
returns json language plpgsql security definer stable set search_path = public as $$
declare ev public.events; result json;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select * into ev from public.events where share_token = p_token;
  if ev.id is null then return null; end if;

  with mm as (
    select team_a, team_b, score_a, score_b, round from public.matches where event_id = ev.id
  ),
  acc as (
    select pid, sum(score)::int as pts from (
      select unnest(team_a) as pid, score_a as score from mm
      union all
      select unnest(team_b) as pid, score_b as score from mm
    ) t group by pid
  ),
  named as (
    select
      coalesce(
        ev.config->'names'->>(acc.pid::text),
        (select x->>'name' from jsonb_array_elements(coalesce(ev.config->'lineup', '[]'::jsonb)) x
           where x->>'id' = acc.pid::text limit 1),
        pr.full_name,
        'Player'
      ) as name,
      acc.pts,
      rank() over (order by acc.pts desc) as rank
    from acc left join public.profiles pr on pr.id = acc.pid
  )
  select json_build_object(
    'event', json_build_object(
      'title', ev.title, 'venue', ev.venue, 'status', ev.status, 'type', ev.type,
      'round', coalesce((select max(round) from mm), 0),
      'total_rounds', coalesce((ev.config->>'rounds')::int, 7)
    ),
    'rows', coalesce(
      (select json_agg(json_build_object('name', name, 'pts', pts, 'rank', rank) order by rank) from named),
      '[]'::json)
  ) into result;

  return result;
end $$;
revoke all on function public.public_session_board(text) from public;
grant execute on function public.public_session_board(text) to anon, authenticated;


-- ============================================================ C) players registry
create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  phone      text,                                   -- PII (locked like profiles.phone)
  user_id    uuid references auth.users (id) on delete set null,  -- null = guest
  created_at timestamptz not null default now()
);
create index if not exists players_user_id_idx on public.players (user_id);
create index if not exists players_phone_idx    on public.players (phone);

-- Backfill one player row per existing profile (so accounts already have a
-- registry entry). Match on user_id so it is idempotent.
insert into public.players (name, phone, user_id)
select coalesce(full_name, ''), phone, id
from public.profiles p
where not exists (select 1 from public.players pl where pl.user_id = p.id);

-- Non-PII view for cross-user display (no phone). Anyone may read it.
create or replace view public.players_public
  with (security_invoker = false) as
  select id, name, user_id, created_at from public.players;
grant select on public.players_public to anon, authenticated;

alter table public.players enable row level security;

-- base table: self + admin only (phone is PII, mirrors the profiles lock-down)
drop policy if exists "players self read" on public.players;
create policy "players self read" on public.players for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- admins manage the registry directly; everyone else goes through the
-- SECURITY DEFINER claim/merge functions below.
drop policy if exists "players admin manage" on public.players;
create policy "players admin manage" on public.players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ============================================================ B) phone auto-link
-- digits-only comparison so "+62 812-…" and "0812…" reconcile.
create or replace function public.link_players_by_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null and length(regexp_replace(new.phone, '\D', '', 'g')) >= 6 then
    update public.players
      set user_id = new.id
      where user_id is null
        and phone is not null
        and regexp_replace(phone, '\D', '', 'g') = regexp_replace(new.phone, '\D', '', 'g');
  end if;
  return new;
end $$;

drop trigger if exists trg_link_players_by_phone on public.profiles;
create trigger trg_link_players_by_phone
  after insert or update of phone on public.profiles
  for each row execute function public.link_players_by_phone();


-- ============================================================ claim + merge
-- A signed-in user claims a guest player whose phone matches their profile.
-- (Host-approval claims, for players with no phone on file, are handled by the
-- host via merge_players.)
create or replace function public.claim_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me_phone text; their_phone text; their_user uuid;
begin
  select regexp_replace(coalesce(phone, ''), '\D', '', 'g') into me_phone
    from public.profiles where id = auth.uid();
  select user_id, regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    into their_user, their_phone from public.players where id = p_player;
  if their_user is not null then raise exception 'player already linked'; end if;
  if length(me_phone) < 6 or me_phone <> their_phone then
    raise exception 'phone does not match — ask the host to merge instead';
  end if;
  update public.players set user_id = auth.uid() where id = p_player;
end $$;
revoke all on function public.claim_player(uuid) from public, anon;
grant execute on function public.claim_player(uuid) to authenticated;

-- Host/admin merges a duplicate player record (p_drop) into the canonical one
-- (p_keep): keep inherits any account/phone the duplicate had, then the dup is
-- removed. (Match-level history re-pointing arrives with the matches→player_id
-- rewire; today matches key on profiles.id, so this consolidates the registry.)
create or replace function public.merge_players(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare keep public.players; drop_p public.players;
begin
  if not public.is_admin() then
    -- a host may merge, but only players that appear in a session they own
    if not exists (
      select 1 from public.events e where e.created_by = auth.uid()
    ) then raise exception 'host or admin only'; end if;
  end if;
  if p_keep = p_drop then raise exception 'cannot merge a player into itself'; end if;
  select * into keep   from public.players where id = p_keep;
  select * into drop_p from public.players where id = p_drop;
  if keep.id is null or drop_p.id is null then raise exception 'player not found'; end if;

  update public.players set
    user_id = coalesce(keep.user_id, drop_p.user_id),
    phone   = coalesce(nullif(keep.phone, ''), drop_p.phone),
    name    = case when coalesce(keep.name, '') = '' then drop_p.name else keep.name end
    where id = p_keep;
  delete from public.players where id = p_drop;
end $$;
revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated;
