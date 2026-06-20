-- ============================================================================
-- 0021 — Fix finish_match for guests + host-only manual status (live/done/cancelled).
--
-- THREE things, all additive / idempotent, wrapped in one transaction:
--
--   A1. finish_match: only write the profiles-FK tables (player_points,
--       player_badges, feed_posts) for participants that ARE accounts. Guest
--       participants previously caused an FK violation that rolled back the
--       WHOLE function — so status never flipped to 'done' and nobody got points
--       (silent failure). The leaderboard W/L for guests already comes from the
--       0020 match-score views (derived from matches.status='done'), so once the
--       flip survives, guests are scored there with no profiles row needed.
--
--   A2a. matches.status: allow 'cancelled' (today it's only 'live'/'done'; the
--        events table already had 'cancelled' since 0001/0014, matches did not).
--   A2b. set_match_status(match_id, status): HOST-ONLY correction RPC. Does NOT
--        run the scoring cascade — auto-scoring stays in finish_match. It only
--        moves status (with finished_at housekeeping). The 0020 views are the
--        leaderboard source of truth and reflect the new status automatically.
--   A2c. Leaderboard EXCLUDES cancelled: 0020's match_player_results did NOT
--        filter status, so a cancelled match's scores still counted. Fixed here
--        by re-creating that single fact view with a status<>'cancelled' guard;
--        every other board (session/global/match_player_points/public_session_board)
--        derives from it and inherits the exclusion automatically.
--
-- Re-runnable: create-or-replace everywhere, drop-constraint-if-exists then add.
-- ============================================================================

begin;


-- ---------------------------------------------------------------------------
-- A2a — allow 'cancelled' on matches (it's a CHECK constraint, NOT an enum;
-- inline checks are auto-named "<table>_<column>_check"). Existing rows are all
-- 'live'/'done', so the new constraint validates with no failures.
-- ---------------------------------------------------------------------------
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches
  add constraint matches_status_check check (status in ('live','done','cancelled'));


-- ---------------------------------------------------------------------------
-- A1 — finish_match (supersedes 0011): identical cascade, but every insert into
-- a profiles-FK table is now guarded so guest participants can't roll it back.
-- ---------------------------------------------------------------------------
create or replace function public.finish_match(p_match_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  ev public.events;
  season int;
  won boolean;
  winners uuid[];
  losers uuid[];
  pid uuid;
  caller uuid := auth.uid();
  narrator uuid;        -- whose result the feed post is written as
  narrator_won boolean;
  my_prev_rank int;
  my_new_rank int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if m is null then raise exception 'match not found'; end if;
  if m.status = 'done'      then raise exception 'match already finished'; end if;
  if m.status = 'cancelled' then raise exception 'match is cancelled'; end if;
  select * into ev from public.events where id = m.event_id;
  -- participants and the host may finish their match; a superadmin may finish
  -- ANY match (admin-run demos against events they didn't create).
  if not (caller = any(m.team_a) or caller = any(m.team_b)
          or caller = ev.created_by or public.is_admin()) then
    raise exception 'only players in this match, the host, or an admin can finish it';
  end if;

  select id into season from public.seasons where is_current limit 1;

  update public.matches set status = 'done', finished_at = now() where id = p_match_id;

  if m.score_a >= m.score_b then winners := m.team_a; losers := m.team_b;
  else winners := m.team_b; losers := m.team_a; end if;

  select rank into my_prev_rank from (
    select player_id, rank() over (order by pts desc) as rank
    from public.player_points where season_id = season) r
  where r.player_id = caller;

  -- player_points: accounts only. Guests are NOT in profiles (player_points
  -- has a profiles FK); their W/L comes from the 0020 match-score views instead.
  foreach pid in array winners loop
    if not exists (select 1 from public.profiles where id = pid) then continue; end if;
    insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
    values (season, pid, ev.pts + 2, 1, 1, 1)
    on conflict (season_id, player_id) do update
      set pts = player_points.pts + ev.pts + 2,
          matches = player_points.matches + 1,
          wins = player_points.wins + 1,
          streak = player_points.streak + 1;
  end loop;
  foreach pid in array losers loop
    if not exists (select 1 from public.profiles where id = pid) then continue; end if;
    insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
    values (season, pid, 2, 1, 0, 0)
    on conflict (season_id, player_id) do update
      set pts = player_points.pts + 2,
          matches = player_points.matches + 1,
          streak = 0;
  end loop;

  -- badges (player_badges also has a profiles FK) — accounts only.
  foreach pid in array winners || losers loop
    if not exists (select 1 from public.profiles where id = pid) then continue; end if;
    insert into public.player_badges (player_id, badge_id) values (pid, 'first-match')
      on conflict do nothing;
    insert into public.player_badges (player_id, badge_id)
      select pid, 'iron-player' from public.player_points
      where season_id = season and player_id = pid and matches >= 50
      on conflict do nothing;
    insert into public.player_badges (player_id, badge_id)
      select pid, 'undefeated' from public.player_points
      where season_id = season and player_id = pid and streak >= 10
      on conflict do nothing;
  end loop;

  -- rank snapshots for everyone in the match (selects from player_points, which
  -- only holds accounts, so this is already guest-safe).
  insert into public.rank_history (season_id, player_id, rank)
  select season, r.player_id, r.rank from (
    select player_id, rank() over (order by pts desc) as rank
    from public.player_points where season_id = season) r
  where r.player_id = any(m.team_a || m.team_b);

  select rank into my_new_rank from (
    select player_id, rank() over (order by pts desc) as rank
    from public.player_points where season_id = season) r
  where r.player_id = caller;

  -- The feed post is written as a participant. When the caller actually played
  -- it's them; for an admin-run demo (caller not in the match) we narrate it as
  -- a winner so the feed reads naturally. feed_posts.author has a profiles FK,
  -- so only post when the narrator is an account (skip silently for guests).
  if caller = any(m.team_a) or caller = any(m.team_b) then narrator := caller;
  else narrator := winners[1]; end if;
  narrator_won := narrator = any(winners);

  if narrator is not null and exists (select 1 from public.profiles where id = narrator) then
    insert into public.feed_posts (author, kind, text, score, sub, is_demo)
    values (narrator, 'result',
            case when narrator_won then 'defeated ' || (case when narrator = any(m.team_a) then m.team_b_names else m.team_a_names end)
                 else 'fell to ' || (case when narrator = any(m.team_a) then m.team_b_names else m.team_a_names end) end,
            greatest(m.score_a, m.score_b) || '–' || least(m.score_a, m.score_b),
            ev.title || ' · +' || (case when narrator_won then ev.pts + 2 else 2 end) || ' pts',
            ev.is_demo);
  end if;

  won := caller = any(winners);
  return json_build_object('won', won, 'score_a', m.score_a, 'score_b', m.score_b,
                           'prev_rank', my_prev_rank, 'new_rank', my_new_rank,
                           'pts', case when won then ev.pts + 2 else 2 end);
end $$;


-- ---------------------------------------------------------------------------
-- A2b — host-only manual status correction. SECURITY DEFINER so it can update
-- past RLS, but it hard-checks that the caller is the event host (created_by)
-- or a superadmin and raises otherwise. It does NOT touch player_points / feed
-- (no double-scoring): the 0020 views derive the leaderboard straight from
-- matches.status, so flipping status is enough for the boards to follow.
-- ---------------------------------------------------------------------------
create or replace function public.set_match_status(p_match_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  ev public.events;
  caller uuid := auth.uid();
begin
  if p_status not in ('live','done','cancelled') then
    raise exception 'invalid status %, expected live|done|cancelled', p_status;
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if m.id is null then raise exception 'match not found'; end if;

  select * into ev from public.events where id = m.event_id;

  -- ONLY the event host or a superadmin may override status. Non-hosts (even
  -- match participants) are rejected.
  if not (caller = ev.created_by or public.is_admin()) then
    raise exception 'only the event host can change match status';
  end if;

  update public.matches
    set status = p_status,
        finished_at = case
          when p_status = 'live' then null            -- reopened: no finish time
          when p_status = 'done' then coalesce(m.finished_at, now())
          else now()                                  -- cancelled: terminal stamp
        end
    where id = p_match_id;

  return json_build_object('match_id', p_match_id, 'status', p_status, 'override', true);
end $$;

revoke all on function public.set_match_status(uuid, text) from public, anon;
grant execute on function public.set_match_status(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- A2c — exclude cancelled from the leaderboard. Re-create ONLY the single fact
-- view from 0020 with a status<>'cancelled' guard (same columns/order/types, so
-- create-or-replace is allowed even though other views depend on it). Every
-- downstream board reads through this view, so they all stop counting cancelled
-- matches with no further changes.
-- ---------------------------------------------------------------------------
create or replace view public.match_player_results
  with (security_invoker = false) as
select event_id, match_id, round, status, finished_at, player_id,
       max(own_score) as own_score,
       max(opp_score) as opp_score,
       bool_or(won)  as won,
       bool_or(lost) as lost
from (
  select m.id as match_id, m.event_id, m.round, m.status, m.finished_at, 'A' as side,
         public.canonical_player(pid) as player_id,
         m.score_a as own_score, m.score_b as opp_score,
         (m.status = 'done' and m.score_a > m.score_b) as won,
         (m.status = 'done' and m.score_a < m.score_b) as lost
  from public.matches m, unnest(m.team_a_players) as pid
  where m.status <> 'cancelled'
  union all
  select m.id, m.event_id, m.round, m.status, m.finished_at, 'B',
         public.canonical_player(pid),
         m.score_b, m.score_a,
         (m.status = 'done' and m.score_b > m.score_a),
         (m.status = 'done' and m.score_b < m.score_a)
  from public.matches m, unnest(m.team_b_players) as pid
  where m.status <> 'cancelled'
) s
where player_id is not null
group by event_id, match_id, round, status, finished_at, player_id, side;


commit;


-- ============================================================================
-- VERIFICATION (read-only — run after applying)
--
-- 1) matches now accepts cancelled:
--      select conname, pg_get_constraintdef(oid)
--      from pg_constraint where conrelid = 'public.matches'::regclass and contype='c';
--      -- expect ...check (status = any (array['live','done','cancelled']))
--
-- 2) A cancelled match contributes ZERO to the boards. Pick a done match with a
--    positive score, cancel it, confirm the player's session pts drops, then
--    restore. (Do on staging, or eyeball an already-cancelled match:)
--      select count(*) as cancelled_rows_in_board
--      from public.match_player_results where status = 'cancelled';
--      -- expect 0
--
-- 3) finish_match survives a guest: a match whose team arrays contain a uuid
--    not in profiles should flip to 'done' (previously rolled back):
--      -- after calling finish_match on such a match:
--      -- select status from public.matches where id = '<id>';  -- expect 'done'
--
-- 4) set_match_status rejects non-hosts: call it as a non-host/non-admin user;
--    expect 'only the event host can change match status'.
-- ============================================================================
