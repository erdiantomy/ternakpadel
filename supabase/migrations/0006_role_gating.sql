-- ============================================================================
-- Role gating: only hosts (profiles.is_host) and superadmins (profiles.is_admin)
-- may create events & matches and approve/reject join requests. Regular players
-- can still request to join, pay, check in, and score their own live matches.
--
-- Safe to run more than once.
-- ============================================================================

-- helper: is the current user a host? security definer avoids RLS recursion
create or replace function public.is_host()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_host from public.profiles where id = auth.uid()), false);
$$;

-- ---- events: only a host/admin may create (and only as themselves) ----------
drop policy if exists "create own events" on public.events;
create policy "create own events" on public.events for insert to authenticated
  with check (created_by = auth.uid() and (public.is_admin() or public.is_host()));

-- ---- matches: only a host/admin may create them -----------------------------
drop policy if exists "host creates matches" on public.matches;
create policy "host creates matches" on public.matches for insert to authenticated
  with check (
    (public.is_admin() or public.is_host())
    and exists (select 1 from public.events e where e.id = event_id)
  );

-- ---- event_players: only a host/admin may approve/reject requests -----------
-- (status only to requested/approved/rejected — never to paid; that is the
--  payment webhook's job). Replaces the prior "event creator or admin" rule.
drop policy if exists "host or admin approve" on public.event_players;
create policy "host or admin approve" on public.event_players for update to authenticated
  using (public.is_admin() or public.is_host())
  with check (status in ('requested','approved','rejected') and paid = false);
