-- ============================================================================
-- Public, shareable leaderboards — /board/<eventId> works with NO login.
--
--   * session_board(event_id) — the live (or final) leaderboard of one session:
--       every player who appears in a match, ranked by the session's scoring
--       mode (points → total points; ranking → wins). Names resolve exactly
--       like the organizer console: session rename → lineup name → profile
--       first name. Only display names and scores are exposed — no PII.
--   * club_board() — the accumulative (all-time) board: aggregates matches of
--       every FINISHED session (status = 'done'), so a session starts counting
--       toward the club board the moment its organizer locks it. Real accounts
--       accumulate by profile id; name-only lineup players by their name, so
--       the same reclub name adds up across sessions.
--
-- Both are SECURITY DEFINER and granted to anon so the share link works for
-- spectators without an account. Demo and cancelled events never appear.
-- Safe to run more than once.
-- ============================================================================

create or replace function public.session_board(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  ev record;
  cfg jsonb;
  v_target_mode text;
  v_score_mode text;
  v_rounds int;
  v_rounds_played int;
  v_rows jsonb;
begin
  select * into ev from events
    where id = p_event_id
      and coalesce(is_demo, false) = false
      and status <> 'cancelled';
  if not found then return null; end if;

  cfg := coalesce(ev.config, '{}'::jsonb);
  v_target_mode := coalesce(nullif(cfg->>'targetMode', ''), 'race');
  v_score_mode  := coalesce(nullif(cfg->>'scoreMode', ''), 'points');
  v_rounds      := greatest(coalesce(nullif(cfg->>'rounds', '')::int, 7), 1);

  select coalesce(max(round), 0) into v_rounds_played
    from matches where event_id = p_event_id;

  with sides as (
    select unnest(m.team_a) as pid, m.score_a as my, m.score_b as opp,
           (case when v_target_mode = 'bestof' then m.score_a + m.score_b >= m.target
                 else m.score_a >= m.target or m.score_b >= m.target end) as complete
    from matches m where m.event_id = p_event_id
    union all
    select unnest(m.team_b), m.score_b, m.score_a,
           (case when v_target_mode = 'bestof' then m.score_a + m.score_b >= m.target
                 else m.score_a >= m.target or m.score_b >= m.target end)
    from matches m where m.event_id = p_event_id
  ),
  agg as (
    select pid,
           sum(my)::int as pts,
           sum(my - opp)::int as diff,
           (count(*) filter (where complete and my > opp))::int as wins,
           (count(*) filter (where complete))::int as played
    from sides group by pid
  ),
  named as (
    select a.*,
           coalesce(
             nullif(cfg->'names'->>(a.pid::text), ''),
             (select l->>'name'
                from jsonb_array_elements(coalesce(cfg->'lineup', '[]'::jsonb)) l
               where l->>'id' = a.pid::text limit 1),
             (select split_part(p.full_name, ' ', 1) from profiles p where p.id = a.pid),
             'Player') as name
    from agg a
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'key', n.pid, 'name', n.name, 'pts', n.pts, 'diff', n.diff,
             'wins', n.wins, 'played', n.played)
           order by
             case when v_score_mode = 'ranking' then n.wins else n.pts end desc,
             n.diff desc,
             case when v_score_mode = 'ranking' then n.pts else n.wins end desc
         ), '[]'::jsonb)
    into v_rows
    from named n;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', ev.id, 'title', ev.title, 'venue', ev.venue, 'status', ev.status,
      'starts_at', ev.starts_at, 'score_mode', v_score_mode,
      'rounds_planned', v_rounds, 'rounds_played', v_rounds_played),
    'rows', v_rows);
end $$;

create or replace function public.club_board()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with ev as (
    select e.id, coalesce(e.config, '{}'::jsonb) as cfg
    from events e
    where e.status = 'done' and coalesce(e.is_demo, false) = false
  ),
  sides as (
    select ev.id as event_id, ev.cfg,
           unnest(m.team_a) as pid, m.score_a as my, m.score_b as opp,
           m.score_a as sa, m.score_b as sb, m.target as tg
    from ev join matches m on m.event_id = ev.id
    union all
    select ev.id, ev.cfg, unnest(m.team_b), m.score_b, m.score_a,
           m.score_a, m.score_b, m.target
    from ev join matches m on m.event_id = ev.id
  ),
  scored as (
    select *,
           (case when coalesce(nullif(cfg->>'targetMode', ''), 'race') = 'bestof'
                 then sa + sb >= tg else sa >= tg or sb >= tg end) as complete
    from sides
  ),
  named as (
    select s.*,
           (select split_part(p.full_name, ' ', 1) from profiles p where p.id = s.pid) as profile_name,
           coalesce(
             nullif(s.cfg->'names'->>(s.pid::text), ''),
             (select l->>'name'
                from jsonb_array_elements(coalesce(s.cfg->'lineup', '[]'::jsonb)) l
               where l->>'id' = s.pid::text limit 1),
             'Player') as session_name,
           exists (select 1 from profiles p where p.id = s.pid) as has_profile
    from scored s
  ),
  keyed as (
    -- real accounts accumulate by id; name-only players by (case-folded) name
    select case when has_profile then 'u:' || pid::text
                else 'n:' || lower(session_name) end as key,
           coalesce(profile_name, session_name) as name,
           event_id, my, opp, complete
    from named
  ),
  agg as (
    select key,
           max(name) as name,
           sum(my)::int as pts,
           sum(my - opp)::int as diff,
           (count(*) filter (where complete and my > opp))::int as wins,
           (count(*) filter (where complete))::int as played,
           (count(distinct event_id))::int as sessions
    from keyed group by key
    order by pts desc, wins desc
    limit 100
  )
  select jsonb_build_object('rows', coalesce(jsonb_agg(
    jsonb_build_object(
      'key', key, 'name', name, 'pts', pts, 'diff', diff,
      'wins', wins, 'played', played, 'sessions', sessions)
    order by pts desc, wins desc), '[]'::jsonb))
  from agg;
$$;

grant execute on function public.session_board(uuid) to anon, authenticated;
grant execute on function public.club_board() to anon, authenticated;
