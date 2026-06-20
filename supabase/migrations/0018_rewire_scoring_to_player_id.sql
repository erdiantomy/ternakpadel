-- ============================================================================
-- 0018 — Make `players` the source of truth for match scoring (ADDITIVE).
--
-- Strategy: add new player_id columns alongside the existing profiles.id-keyed
-- columns, backfill them, keep them fresh with triggers, and move READS to them.
-- The legacy columns (matches.team_a/team_b, *_points.player_id, etc.) are kept
-- untouched as the write inputs and as a safety net — dropping them is a
-- separate, later pass once this is proven in production.
--
-- Guests: every participant id that is not an account gets a real `players` row
-- (re-using the original guest uuid as players.id, so existing match arrays are
-- already valid). This is what lets a guest accumulate history without an
-- account, and lets that history follow them when they later claim/merge.
--
-- All operations are idempotent. Verification queries are at the bottom.
-- ============================================================================


-- ---------------------------------------------------------------- new columns
alter table public.matches       add column if not exists team_a_players uuid[] not null default '{}';
alter table public.matches       add column if not exists team_b_players uuid[] not null default '{}';
alter table public.player_points add column if not exists player_pid uuid references public.players (id);
alter table public.event_players add column if not exists player_pid uuid references public.players (id);
alter table public.rank_history  add column if not exists player_pid uuid references public.players (id);
alter table public.players       add column if not exists merged_into uuid references public.players (id);

create index if not exists player_points_pid_idx on public.player_points (player_pid);
create index if not exists event_players_pid_idx on public.event_players (player_pid);
create index if not exists rank_history_pid_idx  on public.rank_history  (player_pid);
create index if not exists players_merged_into_idx on public.players (merged_into);


-- ---------------------------------------------------- every account has a player
-- (0016 backfilled existing profiles; this covers any gap + future signups.)
insert into public.players (name, phone, user_id)
select coalesce(p.full_name, ''), p.phone, p.id
from public.profiles p
where not exists (select 1 from public.players pl where pl.user_id = p.id);

create or replace function public.handle_new_profile_player()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (name, phone, user_id)
  select coalesce(new.full_name, ''), new.phone, new.id
  where not exists (select 1 from public.players pl where pl.user_id = new.id);
  return new;
end $$;
drop trigger if exists trg_new_profile_player on public.profiles;
create trigger trg_new_profile_player
  after insert on public.profiles
  for each row execute function public.handle_new_profile_player();


-- ------------------------------------------------------- guest players backfill
-- Any participant uuid in a match that is neither an account nor an existing
-- player becomes a guest player, re-using its uuid as players.id. Names come
-- from the owning event's display-name overrides / name-only lineup.
insert into public.players (id, name, user_id)
select g.pid,
  coalesce(
    (select coalesce(
        e.config->'names'->>(g.pid::text),
        (select x->>'name' from jsonb_array_elements(coalesce(e.config->'lineup', '[]'::jsonb)) x
           where x->>'id' = g.pid::text limit 1))
     from public.events e
     where (e.config->'names') ? g.pid::text
        or exists (select 1 from jsonb_array_elements(coalesce(e.config->'lineup', '[]'::jsonb)) x
                     where x->>'id' = g.pid::text)
     limit 1),
    'Guest'),
  null
from (
  select distinct pid from (
    select unnest(team_a) pid from public.matches
    union
    select unnest(team_b) pid from public.matches
  ) t where pid is not null
) g
left join public.profiles pr on pr.id = g.pid
left join public.players  pl on pl.id = g.pid
where pr.id is null and pl.id is null
on conflict (id) do nothing;


-- ----------------------------------------------------------------- mappers
-- participant uuid (profiles.id for accounts, guest uuid for guests) -> players.id
create or replace function public.player_id_of(p uuid)
returns uuid language sql stable set search_path = public as $$
  select coalesce(
    (select id from public.players where user_id = p order by created_at limit 1),
    (select id from public.players where id = p)
  );
$$;

-- follow merge tombstones to the surviving (canonical) player
create or replace function public.canonical_player(p uuid)
returns uuid language sql stable set search_path = public as $$
  with recursive c(id, merged_into, depth) as (
    select id, merged_into, 0 from public.players where id = p
    union all
    select pl.id, pl.merged_into, c.depth + 1
    from public.players pl join c on pl.id = c.merged_into
    where c.depth < 20
  )
  select id from c where merged_into is null limit 1;
$$;


-- ----------------------------------------- keep new columns in sync on write
-- matches: auto-provision a players row for every participant (creating guests
-- on the fly from the event config) and derive the player-id arrays. Means the
-- existing frontend write paths need no change — they still write team_a/team_b.
create or replace function public.sync_match_players()
returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb; pid uuid; nm text;
begin
  select config into cfg from public.events where id = new.event_id;
  foreach pid in array (coalesce(new.team_a, '{}'::uuid[]) || coalesce(new.team_b, '{}'::uuid[])) loop
    if pid is null then continue; end if;
    if exists (select 1 from public.profiles where id = pid) then
      insert into public.players (name, phone, user_id)
      select coalesce(full_name, ''), phone, id from public.profiles
      where id = pid and not exists (select 1 from public.players where user_id = pid);
    elsif not exists (select 1 from public.players where id = pid) then
      nm := coalesce(
        cfg->'names'->>(pid::text),
        (select x->>'name' from jsonb_array_elements(coalesce(cfg->'lineup', '[]'::jsonb)) x
           where x->>'id' = pid::text limit 1),
        'Guest');
      insert into public.players (id, name, user_id) values (pid, nm, null)
        on conflict (id) do nothing;
    end if;
  end loop;
  new.team_a_players := (select coalesce(array_agg(public.player_id_of(x)), '{}'::uuid[])
                           from unnest(coalesce(new.team_a, '{}'::uuid[])) x);
  new.team_b_players := (select coalesce(array_agg(public.player_id_of(x)), '{}'::uuid[])
                           from unnest(coalesce(new.team_b, '{}'::uuid[])) x);
  return new;
end $$;
drop trigger if exists trg_sync_match_players on public.matches;
create trigger trg_sync_match_players
  before insert or update of team_a, team_b on public.matches
  for each row execute function public.sync_match_players();

-- scoring tables: derive player_pid from the legacy player_id on write
create or replace function public.set_player_pid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.player_pid := public.player_id_of(new.player_id);
  return new;
end $$;
drop trigger if exists trg_player_points_pid on public.player_points;
create trigger trg_player_points_pid before insert or update of player_id on public.player_points
  for each row execute function public.set_player_pid();
drop trigger if exists trg_event_players_pid on public.event_players;
create trigger trg_event_players_pid before insert or update of player_id on public.event_players
  for each row execute function public.set_player_pid();
drop trigger if exists trg_rank_history_pid on public.rank_history;
create trigger trg_rank_history_pid before insert or update of player_id on public.rank_history
  for each row execute function public.set_player_pid();


-- ------------------------------------------------------------- one-time backfill
update public.matches set
  team_a_players = (select coalesce(array_agg(public.player_id_of(x)), '{}'::uuid[]) from unnest(coalesce(team_a, '{}'::uuid[])) x),
  team_b_players = (select coalesce(array_agg(public.player_id_of(x)), '{}'::uuid[]) from unnest(coalesce(team_b, '{}'::uuid[])) x);

update public.player_points set player_pid = public.player_id_of(player_id) where player_pid is null;
update public.event_players set player_pid = public.player_id_of(player_id) where player_pid is null;
update public.rank_history  set player_pid = public.player_id_of(player_id) where player_pid is null;


-- ------------------------------------------------------- player_id aggregations
-- Per (match, side) de-dup folds any merged duplicates that land on the same
-- side of the same match (canonical_player resolves merge tombstones), so a
-- merge can never double-count a match. SECURITY DEFINER views expose only
-- non-PII columns and are granted to authenticated only (never anon).
create or replace view public.match_player_points
  with (security_invoker = false) as
select event_id, match_id, round, status, player_id, min(score)::int as score
from (
  select m.id as match_id, m.event_id, m.round, m.status, 'A' as side,
         public.canonical_player(pid) as player_id, m.score_a as score
  from public.matches m, unnest(m.team_a_players) as pid
  union all
  select m.id, m.event_id, m.round, m.status, 'B',
         public.canonical_player(pid), m.score_b
  from public.matches m, unnest(m.team_b_players) as pid
) s
where player_id is not null
group by event_id, match_id, round, status, player_id, side;

create or replace view public.session_leaderboard
  with (security_invoker = false) as
select event_id, player_id, sum(score)::int as pts, count(distinct match_id) as matches
from public.match_player_points
group by event_id, player_id;

create or replace view public.global_leaderboard
  with (security_invoker = false) as
select mpp.player_id, coalesce(nullif(p.name, ''), 'Player') as name,
       sum(mpp.score)::int as pts, count(distinct mpp.match_id) as matches
from public.match_player_points mpp
join public.players p on p.id = mpp.player_id
group by mpp.player_id, p.name;

revoke all on public.match_player_points from anon;
revoke all on public.session_leaderboard from anon;
revoke all on public.global_leaderboard from anon;
grant select on public.match_player_points to authenticated;
grant select on public.session_leaderboard to authenticated;
grant select on public.global_leaderboard  to authenticated;


-- --------------------------------------- public board now aggregates by player_id
create or replace function public.public_session_board(p_token text)
returns json language plpgsql security definer stable set search_path = public as $$
declare ev public.events; result json;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select * into ev from public.events where share_token = p_token;
  if ev.id is null then return null; end if;

  select json_build_object(
    'event', json_build_object(
      'title', ev.title, 'venue', ev.venue, 'status', ev.status, 'type', ev.type,
      'round', coalesce((select max(round) from public.matches where event_id = ev.id), 0),
      'total_rounds', coalesce((ev.config->>'rounds')::int, 7)
    ),
    'rows', coalesce((
      select json_agg(json_build_object('name', name, 'pts', pts, 'rank', rnk) order by rnk)
      from (
        select coalesce(nullif(p.name, ''), 'Player') as name, sl.pts,
               rank() over (order by sl.pts desc) as rnk
        from public.session_leaderboard sl
        join public.players p on p.id = sl.player_id
        where sl.event_id = ev.id
      ) q), '[]'::json)
  ) into result;

  return result;
end $$;
revoke all on function public.public_session_board(text) from public;
grant execute on function public.public_session_board(text) to anon, authenticated;


-- ============================================================================
-- VERIFICATION (read-only — run after applying; all three must hold)
--
-- 1) No orphan participants — every match participant maps to exactly one player:
--      select count(*) as unmapped_participants from (
--        select unnest(team_a) pid from public.matches
--        union all select unnest(team_b) pid from public.matches
--      ) t where t.pid is not null and public.player_id_of(t.pid) is null;
--      -- expect 0
--
-- 2) Array length parity — player-id arrays match the legacy arrays per match:
--      select count(*) as mismatched_matches from public.matches
--      where coalesce(array_length(team_a,1),0) <> coalesce(array_length(team_a_players,1),0)
--         or coalesce(array_length(team_b,1),0) <> coalesce(array_length(team_b_players,1),0);
--      -- expect 0
--
-- 3) Scoring tables fully mapped — no null player_pid where a player_id exists:
--      select
--        (select count(*) from public.player_points where player_id is not null and player_pid is null) as pp_unmapped,
--        (select count(*) from public.event_players where player_id is not null and player_pid is null) as ep_unmapped,
--        (select count(*) from public.rank_history  where player_id is not null and player_pid is null) as rh_unmapped;
--      -- expect 0, 0, 0
--
-- 4) Per-session totals unchanged vs. the legacy sum (parity of the rewrite):
--      with legacy as (
--        select event_id, sum(score)::int s from (
--          select event_id, unnest(team_a), score_a score from public.matches
--          union all select event_id, unnest(team_b), score_b from public.matches) z
--        group by event_id),
--      rewired as (select event_id, sum(pts)::int s from public.session_leaderboard group by event_id)
--      select l.event_id, l.s legacy_total, r.s rewired_total
--      from legacy l join rewired r using (event_id) where l.s <> r.s;
--      -- expect 0 rows (identical before any merges)
-- ============================================================================
