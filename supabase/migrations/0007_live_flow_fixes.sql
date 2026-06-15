-- ============================================================================
-- 0007: make the live-event → scoring → points flow actually work end-to-end.
--
-- Fixes:
--   * start_event()  — seed Round 1 from the paid roster and flip status→live
--                      (there was no way to start an event or create matches).
--   * award_match()  — single source of truth for the scoring cascade, with
--                      proper DRAW handling (was: ties silently counted as a
--                      Team-A win).
--   * end_round()    — finishes EVERY court in the round through the scoring
--                      cascade (the old client path marked matches done with a
--                      plain UPDATE and awarded nobody any points), then seeds
--                      the next round's pairings.
--   * score_match()  — atomic, clamped score increments (the old client read a
--                      value and wrote back an absolute, so two phones on one
--                      court overwrote each other).
--   * finish_match() — now also lets a superadmin finish, delegates to
--                      award_match(), and reports draw points correctly.
--
-- Safe to run more than once (create or replace).
-- ============================================================================

-- ── award_match: the scoring cascade for ONE match ──────────────────────────
-- Marks the match done, awards season points (win = event.pts + 2, loss = 2,
-- draw = event.pts/2 + 2 to both sides), updates streaks, snapshots ranks,
-- awards badges, and posts a single result entry to the feed. Idempotent: a
-- match that is already 'done' is left untouched.
create or replace function public.award_match(p_match_id uuid, p_author uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m       public.matches;
  ev      public.events;
  season  int;
  winners uuid[];
  losers  uuid[];
  draw    boolean := false;
  win_pts int;
  pid     uuid;
begin
  select * into m from public.matches where id = p_match_id for update;
  if m is null then raise exception 'match not found'; end if;
  if m.status = 'done' then return; end if;            -- already scored, no-op

  select * into ev from public.events where id = m.event_id;
  select id into season from public.seasons where is_current limit 1;
  win_pts := ev.pts + 2;

  update public.matches set status = 'done', finished_at = now() where id = p_match_id;

  if    m.score_a > m.score_b then winners := m.team_a; losers := m.team_b;
  elsif m.score_b > m.score_a then winners := m.team_b; losers := m.team_a;
  else  draw := true;
  end if;

  if draw then
    foreach pid in array (m.team_a || m.team_b) loop
      insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
      values (season, pid, (ev.pts / 2) + 2, 1, 0, 0)
      on conflict (season_id, player_id) do update
        set pts     = player_points.pts + (ev.pts / 2) + 2,
            matches = player_points.matches + 1;
    end loop;
  else
    foreach pid in array winners loop
      insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
      values (season, pid, win_pts, 1, 1, 1)
      on conflict (season_id, player_id) do update
        set pts     = player_points.pts + win_pts,
            matches = player_points.matches + 1,
            wins    = player_points.wins + 1,
            streak  = player_points.streak + 1;
    end loop;
    foreach pid in array losers loop
      insert into public.player_points (season_id, player_id, pts, matches, wins, streak)
      values (season, pid, 2, 1, 0, 0)
      on conflict (season_id, player_id) do update
        set pts     = player_points.pts + 2,
            matches = player_points.matches + 1,
            streak  = 0;
    end loop;
  end if;

  -- badges for everyone who played
  foreach pid in array (m.team_a || m.team_b) loop
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

  -- rank snapshot for everyone in the match
  insert into public.rank_history (season_id, player_id, rank)
  select season, r.player_id, r.rank from (
    select player_id, rank() over (order by pts desc) as rank
    from public.player_points where season_id = season) r
  where r.player_id = any(m.team_a || m.team_b);

  -- one result post to the feed
  insert into public.feed_posts (author, kind, text, score, sub)
  values (
    coalesce(p_author, (m.team_a)[1]),
    'result',
    case when draw                 then m.team_a_names || ' drew with ' || m.team_b_names
         when m.score_a > m.score_b then m.team_a_names || ' def. ' || m.team_b_names
         else                            m.team_b_names || ' def. ' || m.team_a_names end,
    greatest(m.score_a, m.score_b) || '–' || least(m.score_a, m.score_b),
    ev.title || case when draw then ' · draw' else ' · +' || win_pts || ' pts' end
  );
end $$;

-- ── finish_match: single-court finish from the Scorer overlay ────────────────
create or replace function public.finish_match(p_match_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  m       public.matches;
  ev      public.events;
  season  int;
  caller  uuid := auth.uid();
  prev_rk int;
  new_rk  int;
  won     boolean;
  pts     int;
begin
  select * into m from public.matches where id = p_match_id;
  if m is null then raise exception 'match not found'; end if;
  if m.status = 'done' then raise exception 'match already finished'; end if;
  select * into ev from public.events where id = m.event_id;
  if not (caller = any(m.team_a) or caller = any(m.team_b)
          or caller = ev.created_by or public.is_admin()) then
    raise exception 'only players in this match, the host, or an admin can finish it';
  end if;

  select id into season from public.seasons where is_current limit 1;

  select rank into prev_rk from (
    select player_id, rank() over (order by pts desc) as rank
    from public.player_points where season_id = season) r
  where r.player_id = caller;

  perform public.award_match(p_match_id, caller);

  select rank into new_rk from (
    select player_id, rank() over (order by pts desc) as rank
    from public.player_points where season_id = season) r
  where r.player_id = caller;

  won := (m.score_a > m.score_b and caller = any(m.team_a))
      or (m.score_b > m.score_a and caller = any(m.team_b));
  pts := case when m.score_a = m.score_b then (ev.pts / 2) + 2
              when won then ev.pts + 2 else 2 end;

  return json_build_object('won', won, 'draw', m.score_a = m.score_b,
                           'score_a', m.score_a, 'score_b', m.score_b,
                           'prev_rank', prev_rk, 'new_rank', new_rk, 'pts', pts);
end $$;

-- ── score_match: atomic, clamped score change ───────────────────────────────
create or replace function public.score_match(p_match_id uuid, p_side text, p_delta int)
returns json language plpgsql security definer set search_path = public as $$
declare
  m      public.matches;
  ev     public.events;
  caller uuid := auth.uid();
  a int; b int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if m is null then raise exception 'match not found'; end if;
  if m.status <> 'live' then raise exception 'match is not live'; end if;
  select * into ev from public.events where id = m.event_id;
  if not (caller = any(m.team_a) or caller = any(m.team_b)
          or caller = ev.created_by or public.is_admin()) then
    raise exception 'not allowed to score this match';
  end if;

  if p_side = 'A' then
    update public.matches set score_a = greatest(0, score_a + p_delta)
      where id = p_match_id returning score_a, score_b into a, b;
  elsif p_side = 'B' then
    update public.matches set score_b = greatest(0, score_b + p_delta)
      where id = p_match_id returning score_a, score_b into a, b;
  else
    raise exception 'side must be A or B';
  end if;

  return json_build_object('score_a', a, 'score_b', b);
end $$;

-- ── start_event: flip to live + seed Round 1 from the paid roster ────────────
-- Americano draw: order by season points, groups of 4 → (1 & 4) vs (2 & 3).
create or replace function public.start_event(p_event_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  ev      public.events;
  season  int;
  roster  uuid[];
  names   text[];
  i       int := 1;
  courts  int := 0;
begin
  select * into ev from public.events where id = p_event_id;
  if ev is null then raise exception 'event not found'; end if;
  if not (public.is_admin() or ev.created_by = auth.uid()) then
    raise exception 'only the host or an admin can start this event';
  end if;
  if ev.status = 'live' then raise exception 'event is already live'; end if;
  if ev.status = 'done' then raise exception 'event already finished'; end if;

  select id into season from public.seasons where is_current limit 1;

  select array_agg(t.id order by t.pts desc, t.full_name),
         array_agg(split_part(t.full_name, ' ', 1) order by t.pts desc, t.full_name)
    into roster, names
  from (
    select p.id, p.full_name, coalesce(pp.pts, 0) as pts
    from public.event_players ep
    join public.profiles p on p.id = ep.player_id
    left join public.player_points pp on pp.player_id = p.id and pp.season_id = season
    where ep.event_id = p_event_id and (ep.paid or ep.status = 'paid')
  ) t;

  if roster is null or array_length(roster, 1) < 4 then
    raise exception 'need at least 4 paid players to start (have %)',
      coalesce(array_length(roster, 1), 0);
  end if;

  update public.events set status = 'live' where id = p_event_id;

  while i + 3 <= array_length(roster, 1) loop
    courts := courts + 1;
    insert into public.matches (event_id, round, court, team_a, team_b, team_a_names, team_b_names)
    values (
      p_event_id, 1, courts,
      array[roster[i], roster[i + 3]],
      array[roster[i + 1], roster[i + 2]],
      names[i] || ' / ' || names[i + 3],
      names[i + 1] || ' / ' || names[i + 2]
    );
    i := i + 4;
  end loop;

  return json_build_object('event_id', p_event_id, 'round', 1,
                           'courts', courts, 'players', array_length(roster, 1));
end $$;

-- ── end_round: score every court, then seed the next round ───────────────────
create or replace function public.end_round(p_event_id uuid, p_round int)
returns json language plpgsql security definer set search_path = public as $$
declare
  ev        public.events;
  m         public.matches;
  finished  int := 0;
  standings uuid[];
  names     text[];
  i         int := 1;
  courts    int := 0;
  author    uuid;
begin
  select * into ev from public.events where id = p_event_id;
  if ev is null then raise exception 'event not found'; end if;
  if not (public.is_admin() or ev.created_by = auth.uid()) then
    raise exception 'only the host or an admin can end the round';
  end if;

  -- award + close every live match in this round
  for m in select * from public.matches
           where event_id = p_event_id and round = p_round and status = 'live'
           order by court loop
    if m.score_a >= m.score_b then author := (m.team_a)[1]; else author := (m.team_b)[1]; end if;
    perform public.award_match(m.id, author);
    finished := finished + 1;
  end loop;

  if finished = 0 then
    raise exception 'no live matches to end in round %', p_round;
  end if;

  -- next pairings, seeded by cumulative event standings (sum of team scores)
  select array_agg(s.player_id order by s.pts desc),
         array_agg(split_part(pr.full_name, ' ', 1) order by s.pts desc)
    into standings, names
  from (
    select pid as player_id, sum(sc)::int as pts from (
      select unnest(team_a) as pid, score_a as sc from public.matches where event_id = p_event_id
      union all
      select unnest(team_b) as pid, score_b as sc from public.matches where event_id = p_event_id
    ) x group by pid
  ) s
  join public.profiles pr on pr.id = s.player_id;

  while standings is not null and i + 3 <= array_length(standings, 1) loop
    courts := courts + 1;
    insert into public.matches (event_id, round, court, team_a, team_b, team_a_names, team_b_names)
    values (
      p_event_id, p_round + 1, courts,
      array[standings[i], standings[i + 3]],
      array[standings[i + 1], standings[i + 2]],
      names[i] || ' / ' || names[i + 3],
      names[i + 1] || ' / ' || names[i + 2]
    );
    i := i + 4;
  end loop;

  return json_build_object('event_id', p_event_id, 'finished', finished,
                           'next_round', p_round + 1, 'courts', courts);
end $$;
