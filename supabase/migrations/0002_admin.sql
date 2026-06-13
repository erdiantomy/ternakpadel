-- 0002: superadmin role + admin-console access policies
-- Run this in the Supabase SQL editor, then grant yourself admin (see bottom).

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- helper: is the current user an admin? security definer avoids RLS recursion
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- admins get full read/write on the operational tables (additive to existing policies)
drop policy if exists "admin manage payments" on public.payments;
create policy "admin manage payments" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage events" on public.events;
create policy "admin manage events" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage matches" on public.matches;
create policy "admin manage matches" on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage rosters" on public.event_players;
create policy "admin manage rosters" on public.event_players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage feed" on public.feed_posts;
create policy "admin manage feed" on public.feed_posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── grant yourself superadmin (replace the email with your Google login) ──
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'you@gmail.com');
