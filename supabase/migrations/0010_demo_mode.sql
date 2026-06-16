-- ============================================================================
-- Demo Mode: admin-driven manual fulfilment.
--
-- Demo Mode is NOT a sandbox — an admin operates the whole flow from the
-- backend (create events, register temporary players, score, finish matches)
-- and the results feed the REAL leaderboard, so a player onboarded during a
-- demo keeps the same ID and points when they go live.
--
-- The admin console already has full write access to events / matches /
-- event_players via the "admin manage *" policies (0002_admin.sql), so
-- bypassing payment is just marking event_players.paid = true (no new policy
-- needed). The one gap is finish_match(), which only lets a match participant
-- or the event creator end a match. This migration lets a superadmin finish
-- ANY match so they can run demos in events they didn't personally create.
--
-- Safe to run more than once.
-- ============================================================================

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
  if m.status = 'done' then raise exception 'match already finished'; end if;
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

  foreach pid in array winners loop
    insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
    values (season, pid, ev.pts + 2, 1, 1, 1)
    on conflict (season_id, player_id) do update
      set pts = player_points.pts + ev.pts + 2,
          matches = player_points.matches + 1,
          wins = player_points.wins + 1,
          streak = player_points.streak + 1;
  end loop;
  foreach pid in array losers loop
    insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
    values (season, pid, 2, 1, 0, 0)
    on conflict (season_id, player_id) do update
      set pts = player_points.pts + 2,
          matches = player_points.matches + 1,
          streak = 0;
  end loop;

  -- badges
  foreach pid in array winners || losers loop
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

  -- rank snapshots for everyone in the match
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
  -- a winner so the feed reads naturally instead of "admin fell to …".
  if caller = any(m.team_a) or caller = any(m.team_b) then narrator := caller;
  else narrator := winners[1]; end if;
  narrator_won := narrator = any(winners);

  insert into public.feed_posts (author, kind, text, score, sub)
  values (narrator, 'result',
          case when narrator_won then 'defeated ' || (case when narrator = any(m.team_a) then m.team_b_names else m.team_a_names end)
               else 'fell to ' || (case when narrator = any(m.team_a) then m.team_b_names else m.team_a_names end) end,
          greatest(m.score_a, m.score_b) || '–' || least(m.score_a, m.score_b),
          ev.title || ' · +' || (case when narrator_won then ev.pts + 2 else 2 end) || ' pts');

  won := caller = any(winners);
  return json_build_object('won', won, 'score_a', m.score_a, 'score_b', m.score_b,
                           'prev_rank', my_prev_rank, 'new_rank', my_new_rank,
                           'pts', case when won then ev.pts + 2 else 2 end);
end $$;
