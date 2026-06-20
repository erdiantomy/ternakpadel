-- ============================================================================
-- 0020 — One leaderboard source of truth, keyed by player_id (guest first-class).
--
-- Before this: two metrics could disagree.
--   (1) player_points (win-bonus: win = ev.pts+2, loss = 2) — accounts only,
--       read by the in-app Season leaderboard + Profile stats.
--   (2) match-score-by-player_id views (sum of own-side game scores) — guests
--       included, read by the public board / per-session standings / global.
--
-- This consolidates onto ONE definition: the Mexicano match-score sum by
-- canonical player_id (reuses 0018's player_pid arrays + canonical_player()).
-- A single fact view (match_player_results) feeds BOTH the per-session and the
-- global leaderboards, so every reader (Season in-app, Profile, public board,
-- global) shows identical numbers and guests appear everywhere by real name.
--
-- Non-destructive: player_points / finish_match are KEPT as a bridge (badges,
-- feed, rank snapshots) but are NO LONGER a leaderboard number source. Dropping
-- them is a separate later pass. Additive + idempotent. No third scoring engine
-- is introduced — this folds the two existing ones into the match-score view.
-- ============================================================================


-- ---------------------------------------------- single fact view (per player·match)
-- One row per (match, side, canonical player): the player's own-side score, the
-- opponent score, and (for finished matches) win/loss. Same per-(match,side)
-- de-dup as 0018, so a merge can never double-count within a side. EVERY other
-- leaderboard reads from this view — one definition, shared.
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
  union all
  select m.id, m.event_id, m.round, m.status, m.finished_at, 'B',
         public.canonical_player(pid),
         m.score_b, m.score_a,
         (m.status = 'done' and m.score_b > m.score_a),
         (m.status = 'done' and m.score_b < m.score_a)
  from public.matches m, unnest(m.team_b_players) as pid
) s
where player_id is not null
group by event_id, match_id, round, status, finished_at, player_id, side;

-- keep the 0018 view name as a thin projection (same shape) so nothing breaks;
-- it now derives from the single fact view rather than duplicating the unnest.
create or replace view public.match_player_points
  with (security_invoker = false) as
select event_id, match_id, round, status, player_id, own_score as score
from public.match_player_results;

-- per-session leaderboard (now carries wins/losses too) — from the fact view
create or replace view public.session_leaderboard
  with (security_invoker = false) as
select event_id, player_id,
       sum(own_score)::int        as pts,
       count(distinct match_id)   as matches,
       count(*) filter (where won)  as wins,
       count(*) filter (where lost) as losses
from public.match_player_results
group by event_id, player_id;

-- global leaderboard (career) — from the fact view, with current win streak.
-- This is THE Season/Profile/global number now.
create or replace view public.global_leaderboard
  with (security_invoker = false) as
with agg as (
  select player_id,
         sum(own_score)::int        as pts,
         count(distinct match_id)   as matches,
         count(*) filter (where won)  as wins,
         count(*) filter (where lost) as losses
  from public.match_player_results
  group by player_id
),
ordered as (
  -- scanning newest→oldest finished matches, count losses seen so far (inclusive)
  select player_id, won,
         sum(case when lost then 1 else 0 end) over (
           partition by player_id
           order by finished_at desc nulls last, match_id desc
           rows between unbounded preceding and current row
         ) as losses_so_far
  from public.match_player_results
  where status = 'done'
),
strk as (
  -- current streak = leading wins before the most recent loss
  select player_id, count(*)::int as streak
  from ordered
  where losses_so_far = 0 and won
  group by player_id
)
select a.player_id,
       coalesce(nullif(p.name, ''), 'Player') as name,
       a.pts, a.matches, a.wins, a.losses,
       coalesce(s.streak, 0) as streak
from agg a
join public.players p on p.id = a.player_id
left join strk s on s.player_id = a.player_id;

-- PII-safe: authenticated-only, no phone/email. (Public board stays RPC-only.)
revoke all on public.match_player_results from anon;
revoke all on public.match_player_points  from anon;
revoke all on public.session_leaderboard   from anon;
revoke all on public.global_leaderboard     from anon;
grant select on public.match_player_results to authenticated;
grant select on public.match_player_points  to authenticated;
grant select on public.session_leaderboard   to authenticated;
grant select on public.global_leaderboard     to authenticated;

-- public_session_board (0018) already reads session_leaderboard.pts (= sum of
-- own-side scores), which is unchanged by this refactor — so the public board is
-- already on the single source. Left as-is.


-- ============================================================================
-- VERIFICATION (read-only; run after applying — all must be 0 rows / as noted)
--
-- 1) PER-SESSION PARITY — the unified per-session number equals the raw match
--    score sum (and the public board reads this exact view, so it agrees too):
--      with legacy as (
--        select event_id, public.player_id_of(pid) as player_id, sum(score)::int s
--        from (
--          select event_id, unnest(team_a) pid, score_a score from public.matches
--          union all
--          select event_id, unnest(team_b) pid, score_b score from public.matches
--        ) z group by event_id, public.player_id_of(pid)
--      )
--      select l.event_id, l.player_id, l.s legacy, sl.pts unified
--      from legacy l
--      full join public.session_leaderboard sl
--        on sl.event_id = l.event_id and sl.player_id = public.canonical_player(l.player_id)
--      where coalesce(l.s,0) <> coalesce(sl.pts,0);
--      -- expect 0 rows (identical before any merges)
--
-- 2) GLOBAL == sum of per-session (Season in-app/Profile read global; both equal
--    the per-session board summed over sessions):
--      select g.player_id, g.pts global_pts, t.s session_sum
--      from public.global_leaderboard g
--      join (select player_id, sum(pts)::int s from public.session_leaderboard group by player_id) t
--        on t.player_id = g.player_id
--      where g.pts <> t.s;
--      -- expect 0 rows
--
-- 3) GUESTS NOT DROPPED — every guest (players.user_id is null) that played a
--    match appears in the global leaderboard:
--      select pl.id
--      from public.players pl
--      where pl.user_id is null and pl.merged_into is null
--        and exists (
--          select 1 from public.match_player_results r where r.player_id = pl.id)
--        and not exists (
--          select 1 from public.global_leaderboard g where g.player_id = pl.id);
--      -- expect 0 rows
--
-- 4) ACCOUNT NUMBERS UNCHANGED vs the correct source — an account's new Season
--    pts equals the match-score sum it already showed (NOT the retired win-bonus
--    player_points, which is intentionally superseded):
--      with acct as (
--        select g.player_id, pl.user_id, g.pts
--        from public.global_leaderboard g
--        join public.players pl on pl.id = g.player_id
--        where pl.user_id is not null
--      ),
--      raw as (
--        select public.canonical_player(public.player_id_of(pid)) player_id, sum(score)::int s
--        from (
--          select unnest(team_a) pid, score_a score from public.matches
--          union all select unnest(team_b) pid, score_b score from public.matches
--        ) z group by 1
--      )
--      select a.player_id, a.pts, r.s
--      from acct a join raw r on r.player_id = a.player_id
--      where a.pts <> r.s;
--      -- expect 0 rows
-- ============================================================================
