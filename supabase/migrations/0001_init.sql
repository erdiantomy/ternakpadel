-- Ternak Padel — initial schema
-- Apply with: supabase db push   (or paste into the SQL editor)

-- ============================================================ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text not null default '',
  phone text,
  skill text not null default 'Intermediate',
  side text not null default 'Left',
  play_freq text,
  goal text,
  city text not null default 'Jakarta',
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create a profile row on signup (phone comes from WhatsApp OTP auth)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone);
  insert into public.player_badges (player_id, badge_id) values (new.id, 'rookie');
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ seasons & points
create table public.seasons (
  id serial primary key,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false
);
insert into public.seasons (name, starts_on, ends_on, is_current)
values ('Season 3', '2026-04-01', '2026-08-31', true);

create table public.player_points (
  season_id int not null references public.seasons (id),
  player_id uuid not null references public.profiles (id) on delete cascade,
  pts int not null default 0,
  matches int not null default 0,
  wins int not null default 0,
  streak int not null default 0,
  primary key (season_id, player_id)
);

create table public.rank_history (
  id bigserial primary key,
  season_id int not null references public.seasons (id),
  player_id uuid not null references public.profiles (id) on delete cascade,
  rank int not null,
  recorded_at timestamptz not null default now()
);

-- ============================================================ events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('Americano','Mexicano','League','King of the Hill','Knockout','Mixicano')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text not null,
  courts int not null default 4 check (courts between 1 and 8),
  fee int not null default 100000,
  pts int not null default 10,
  max_players int not null default 16 check (max_players between 4 and 64),
  description text not null default '',
  status text not null default 'open' check (status in ('open','live','done','cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.event_players (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  paid boolean not null default false,
  checked_in boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

-- ============================================================ payments (written by edge functions only)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  player_id uuid not null references public.profiles (id),
  amount int not null,
  provider text not null default 'xendit',
  external_id text unique,           -- xendit invoice id
  invoice_url text,
  method text,                       -- QRIS / OVO / DANA / ...
  status text not null default 'pending' check (status in ('pending','paid','expired','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ============================================================ matches (live scoring)
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  round int not null default 1,
  court int not null default 1,
  team_a uuid[] not null default '{}',
  team_b uuid[] not null default '{}',
  team_a_names text not null,        -- denormalized for display + walk-ins
  team_b_names text not null,
  score_a int not null default 0 check (score_a >= 0),
  score_b int not null default 0 check (score_b >= 0),
  target int not null default 21,
  status text not null default 'live' check (status in ('live','done')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.matches (event_id, round);

-- per-event standings: sum of your team's points across the event
create or replace view public.event_standings as
select m.event_id, p.id as player_id, p.full_name, p.username,
       sum(case when p.id = any(m.team_a) then m.score_a else m.score_b end)::int as pts
from public.matches m
join public.profiles p on p.id = any(m.team_a || m.team_b)
group by m.event_id, p.id;

-- ============================================================ feed & badges
create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('result','rank','badge','join')),
  text text not null,
  score text not null default '',
  sub text not null default '',
  created_at timestamptz not null default now()
);

create table public.feed_likes (
  post_id uuid not null references public.feed_posts (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, player_id)
);

create table public.badges (
  id text primary key,
  icon text not null,
  name text not null,
  sub text not null default '',
  sort int not null default 0
);
insert into public.badges (id, icon, name, sub, sort) values
  ('rookie',       '🏅', 'Rookie',           'Joined Ternak Padel', 0),
  ('first-match',  '🎾', 'First Match',      '',                    1),
  ('iron-player',  '⚔️', 'Iron Player',      '50 matches',          2),
  ('butterfly',    '🦋', 'Social Butterfly', '50 partners',         3),
  ('undefeated',   '🔥', 'Undefeated',       '10 straight',         4),
  ('koth-winner',  '👑', 'KOTH Winner',      '',                    5),
  ('champion',     '🏆', 'Champion',         '',                    6);

create table public.player_badges (
  player_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id),
  earned_at timestamptz not null default now(),
  primary key (player_id, badge_id)
);

-- ============================================================ finish_match: the win cascade
-- Ends a match, awards season points (winners: event.pts + 2, losers: 2),
-- updates streaks, snapshots ranks, awards badges, posts to the feed.
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
  my_prev_rank int;
  my_new_rank int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if m is null then raise exception 'match not found'; end if;
  if m.status = 'done' then raise exception 'match already finished'; end if;
  select * into ev from public.events where id = m.event_id;
  if not (caller = any(m.team_a) or caller = any(m.team_b) or caller = ev.created_by) then
    raise exception 'only players in this match or the host can finish it';
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

  won := caller = any(winners);
  insert into public.feed_posts (author, kind, text, score, sub)
  values (caller, 'result',
          case when won then 'defeated ' || (case when caller = any(m.team_a) then m.team_b_names else m.team_a_names end)
               else 'fell to ' || (case when caller = any(m.team_a) then m.team_b_names else m.team_a_names end) end,
          greatest(m.score_a, m.score_b) || '–' || least(m.score_a, m.score_b),
          ev.title || ' · +' || (case when won then ev.pts + 2 else 2 end) || ' pts');

  return json_build_object('won', won, 'score_a', m.score_a, 'score_b', m.score_b,
                           'prev_rank', my_prev_rank, 'new_rank', my_new_rank,
                           'pts', case when won then ev.pts + 2 else 2 end);
end $$;

-- ============================================================ RLS
alter table public.profiles      enable row level security;
alter table public.seasons       enable row level security;
alter table public.player_points enable row level security;
alter table public.rank_history  enable row level security;
alter table public.events        enable row level security;
alter table public.event_players enable row level security;
alter table public.payments      enable row level security;
alter table public.matches       enable row level security;
alter table public.feed_posts    enable row level security;
alter table public.feed_likes    enable row level security;
alter table public.badges        enable row level security;
alter table public.player_badges enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "seasons readable" on public.seasons for select to authenticated using (true);
create policy "points readable" on public.player_points for select to authenticated using (true);
create policy "rank history readable" on public.rank_history for select to authenticated using (true);
create policy "badges readable" on public.badges for select to authenticated using (true);
create policy "player badges readable" on public.player_badges for select to authenticated using (true);

create policy "events readable" on public.events for select to authenticated using (true);
create policy "create own events" on public.events for insert to authenticated with check (created_by = auth.uid());
create policy "host updates own events" on public.events for update to authenticated using (created_by = auth.uid());

create policy "rosters readable" on public.event_players for select to authenticated using (true);
-- players may register themselves (unpaid); the payment webhook (service role) flips paid
create policy "join event" on public.event_players for insert to authenticated
  with check (player_id = auth.uid() and paid = false);
create policy "own row update" on public.event_players for update to authenticated
  using (player_id = auth.uid()) with check (paid = (select paid from public.event_players ep where ep.event_id = event_players.event_id and ep.player_id = auth.uid()));

create policy "own payments readable" on public.payments for select to authenticated using (player_id = auth.uid());
-- payments are written exclusively by edge functions (service role bypasses RLS)

create policy "matches readable" on public.matches for select to authenticated using (true);
create policy "host creates matches" on public.matches for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));
create policy "players & host score" on public.matches for update to authenticated
  using (auth.uid() = any(team_a) or auth.uid() = any(team_b)
         or exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));

create policy "feed readable" on public.feed_posts for select to authenticated using (true);
create policy "post as self" on public.feed_posts for insert to authenticated with check (author = auth.uid());

create policy "likes readable" on public.feed_likes for select to authenticated using (true);
create policy "like as self" on public.feed_likes for insert to authenticated with check (player_id = auth.uid());
create policy "unlike as self" on public.feed_likes for delete to authenticated using (player_id = auth.uid());

-- ============================================================ realtime
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.event_players;
alter publication supabase_realtime add table public.feed_posts;
alter publication supabase_realtime add table public.feed_likes;
alter publication supabase_realtime add table public.payments;
