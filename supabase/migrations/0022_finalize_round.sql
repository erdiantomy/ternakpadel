-- ============================================================================
-- Finalize Round: make "End round" (host) properly close each match.
--
-- Previously the host's "End round" bypassed finish_match and did a raw
-- UPDATE status='done', so points / badges / rank / feed were never written.
--
-- This migration:
--   A) Adds 'cancelled' as a valid match status.
--   B) Creates finalize_round(event_id, round) — batch-finishes all live
--      matches in a round: scored → 'done' (with side-effects), unscored →
--      'cancelled'. Guest-safe: skips FK-dependent writes for players not in
--      profiles.
--
-- Safe to run more than once (CREATE OR REPLACE, IF NOT EXISTS).
-- Apply manually via SQL Editor.
-- ============================================================================

-- A) Widen match status constraint to include 'cancelled'
-- -----------------------------------------------------------
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('live', 'done', 'cancelled'));


-- B) finalize_round — called by the host "End round" button
-- -----------------------------------------------------------
create or replace function public.finalize_round(p_event_id uuid, p_round int)
returns json language plpgsql security definer set search_path = public as $$
declare
  ev        public.events;
  m         record;
  season    int;
  winners   uuid[];
  losers    uuid[];
  pid       uuid;
  narrator  uuid;
  narrator_won boolean;
  cnt_done  int := 0;
  cnt_cancel int := 0;
  caller    uuid := auth.uid();
begin
  -- auth: only event host or admin
  select * into ev from public.events where id = p_event_id;
  if ev is null then raise exception 'event not found'; end if;
  if caller <> ev.created_by and not public.is_admin() then
    raise exception 'only the event host or an admin can finalize a round';
  end if;

  select id into season from public.seasons where is_current limit 1;

  for m in
    select * from public.matches
    where event_id = p_event_id and round = p_round and status = 'live'
    for update
  loop
    -- ── scored match → done ──────────────────────────────────────────
    if coalesce(m.score_a, 0) > 0 or coalesce(m.score_b, 0) > 0 then

      update public.matches
        set status = 'done', finished_at = now()
        where id = m.id;
      cnt_done := cnt_done + 1;

      -- determine winners / losers
      if m.score_a >= m.score_b then
        winners := m.team_a; losers := m.team_b;
      else
        winners := m.team_b; losers := m.team_a;
      end if;

      -- player_points (guest-safe: skip players not in profiles)
      if season is not null then
        foreach pid in array winners loop
          if exists (select 1 from public.profiles where id = pid) then
            insert into public.player_points
              (season_id, player_id, pts, matches, wins, streak)
            values
              (season, pid, ev.pts + 2, 1, 1, 1)
            on conflict (season_id, player_id) do update
              set pts     = player_points.pts + ev.pts + 2,
                  matches = player_points.matches + 1,
                  wins    = player_points.wins + 1,
                  streak  = player_points.streak + 1;
          end if;
        end loop;

        foreach pid in array losers loop
          if exists (select 1 from public.profiles where id = pid) then
            insert into public.player_points
              (season_id, player_id, pts, matches, wins, streak)
            values
              (season, pid, 2, 1, 0, 0)
            on conflict (season_id, player_id) do update
              set pts     = player_points.pts + 2,
                  matches = player_points.matches + 1,
                  streak  = 0;
          end if;
        end loop;

        -- badges (guest-safe)
        foreach pid in array winners || losers loop
          if exists (select 1 from public.profiles where id = pid) then
            insert into public.player_badges (player_id, badge_id)
              values (pid, 'first-match')
              on conflict do nothing;
            insert into public.player_badges (player_id, badge_id)
              select pid, 'iron-player' from public.player_points
              where season_id = season and player_id = pid and matches >= 50
              on conflict do nothing;
            insert into public.player_badges (player_id, badge_id)
              select pid, 'undefeated' from public.player_points
              where season_id = season and player_id = pid and streak >= 10
              on conflict do nothing;
          end if;
        end loop;

        -- rank snapshots (guest-safe: inner join with profiles filters them)
        insert into public.rank_history (season_id, player_id, rank)
        select season, r.player_id, r.rank from (
          select player_id, rank() over (order by pts desc) as rank
          from public.player_points where season_id = season) r
        where r.player_id = any(m.team_a || m.team_b)
          and exists (select 1 from public.profiles where id = r.player_id);
      end if; -- season not null

      -- feed post (guest-safe: pick first non-guest winner as narrator)
      narrator := null;
      foreach pid in array winners loop
        if exists (select 1 from public.profiles where id = pid) then
          narrator := pid; exit;
        end if;
      end loop;
      if narrator is null then
        foreach pid in array losers loop
          if exists (select 1 from public.profiles where id = pid) then
            narrator := pid; exit;
          end if;
        end loop;
      end if;

      if narrator is not null then
        narrator_won := narrator = any(winners);
        insert into public.feed_posts (author, kind, text, score, sub, is_demo)
        values (
          narrator,
          'result',
          case when narrator_won
            then 'defeated ' || (case when narrator = any(m.team_a) then m.team_b_names else m.team_a_names end)
            else 'fell to '  || (case when narrator = any(m.team_a) then m.team_b_names else m.team_a_names end)
          end,
          greatest(m.score_a, m.score_b) || '–' || least(m.score_a, m.score_b),
          ev.title || ' · +' || (case when narrator_won then ev.pts + 2 else 2 end) || ' pts',
          ev.is_demo
        );
      end if;

    -- ── unscored match → cancelled ───────────────────────────────────
    else
      update public.matches
        set status = 'cancelled', finished_at = now()
        where id = m.id;
      cnt_cancel := cnt_cancel + 1;
    end if;

  end loop;

  return json_build_object('done', cnt_done, 'cancelled', cnt_cancel);
end $$;


-- ============================================================================
-- OPTIONAL BACKFILL — run separately if desired.
-- Fixes 37 stuck 'live' matches from before this migration.
-- Sets finished_at = created_at (preserves chronological order for streaks).
-- Does NOT backfill points/badges (would need per-match winner logic).
-- ============================================================================
--
-- UPDATE public.matches
--   SET status = 'done', finished_at = created_at
--   WHERE status = 'live'
--     AND (coalesce(score_a, 0) > 0 OR coalesce(score_b, 0) > 0);
--
-- UPDATE public.matches
--   SET status = 'cancelled', finished_at = created_at
--   WHERE status = 'live'
--     AND coalesce(score_a, 0) = 0
--     AND coalesce(score_b, 0) = 0;
