-- ============================================================================
-- H2 — restrict the profiles base table to self + admin so customer phone
-- numbers are no longer readable by every signed-in user. Cross-user name
-- display goes through public.profiles_public (safe columns, no phone), added
-- in 0007. Apply only AFTER the frontend using profiles_public is deployed.
-- Safe to run more than once.
-- ============================================================================

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
