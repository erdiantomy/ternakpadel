-- ============================================================================
-- 0019 — Real history transfer for merge_players / claim_player + phone link.
--
-- With 0018 in place, all scoring aggregates by canonical_player(), which follows
-- the players.merged_into tombstone. So unifying two records' history is done by
-- pointing the dropped record at the surviving one — match participation, session
-- points and per-session participation then ALL count under the survivor, with no
-- row movement, fully idempotent, and the leaderboard views de-dup the case where
-- both records appear in the same match. Identity (account/phone) is inherited
-- safely so a user_id is never duplicated across two live player rows.
--
-- Additive + idempotent.
-- ============================================================================


-- ---------------------------------------------------------------- merge_players
create or replace function public.merge_players(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare keep public.players; drop_p public.players; ck uuid; cd uuid;
begin
  -- a superadmin, or any host (someone who has created an event), may merge
  if not (public.is_admin() or exists (select 1 from public.events where created_by = auth.uid())) then
    raise exception 'host or admin only';
  end if;

  ck := public.canonical_player(p_keep);
  cd := public.canonical_player(p_drop);
  if ck is null or cd is null then raise exception 'player not found'; end if;
  if ck = cd then return; end if;  -- same record / already merged → idempotent

  select * into keep   from public.players where id = ck;
  select * into drop_p from public.players where id = cd;

  -- the survivor inherits phone/name when it has none of its own
  update public.players set
    phone = coalesce(nullif(keep.phone, ''), drop_p.phone),
    name  = case when coalesce(keep.name, '') = '' then drop_p.name else keep.name end
  where id = ck;

  -- account inheritance: only move user_id when the survivor lacks one, and then
  -- clear it on the dropped row so no two live rows share a user_id. When both
  -- already hold (different) accounts, leave the dropped row's user_id in place —
  -- player_id_of() on its profile still resolves to the dropped row, which
  -- canonicalizes to the survivor.
  if keep.user_id is null and drop_p.user_id is not null then
    update public.players set user_id = drop_p.user_id where id = ck;
    update public.players set user_id = null            where id = cd;
  end if;

  -- tombstone the dropped record (and re-point anything that pointed at it)
  update public.players set merged_into = ck where id = cd;
  update public.players set merged_into = ck where merged_into = cd;
end $$;
revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------- claim_player
-- A signed-in user attaches a guest player to their own account: phone must
-- match (canonical form), then the guest is merged into the caller's player so
-- its entire history follows the account.
create or replace function public.claim_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare my_player uuid; me_phone text; their_phone text; their_user uuid;
begin
  -- caller's canonical player (create one if somehow missing)
  select public.canonical_player(id) into my_player
    from public.players where user_id = auth.uid() order by created_at limit 1;
  if my_player is null then
    insert into public.players (name, phone, user_id)
      select coalesce(full_name, ''), phone, id from public.profiles where id = auth.uid()
      returning id into my_player;
  end if;

  select user_id, public.normalize_phone(phone) into their_user, their_phone
    from public.players where id = p_player;
  if their_user is not null then raise exception 'player already linked to an account'; end if;

  select public.normalize_phone(phone) into me_phone from public.profiles where id = auth.uid();
  if me_phone is null or me_phone is distinct from their_phone then
    raise exception 'phone does not match — ask the host to merge instead';
  end if;

  perform public.merge_players(my_player, p_player);
end $$;
revoke all on function public.claim_player(uuid) from public, anon;
grant execute on function public.claim_player(uuid) to authenticated;


-- ---------------------------------------------------------- phone auto-link → merge
-- When a user saves/updates their phone, fold every matching guest player into
-- the user's canonical player (not a bare user_id set — that could create two
-- rows for one account). Uses the canonical phone form from 0017.
create or replace function public.link_players_by_phone()
returns trigger language plpgsql security definer set search_path = public as $$
declare my_player uuid; g uuid;
begin
  if public.normalize_phone(new.phone) is null then return new; end if;

  select public.canonical_player(id) into my_player
    from public.players where user_id = new.id order by created_at limit 1;
  if my_player is null then
    insert into public.players (name, phone, user_id)
      select coalesce(new.full_name, ''), new.phone, new.id
      where not exists (select 1 from public.players where user_id = new.id)
      returning id into my_player;
    if my_player is null then
      select public.canonical_player(id) into my_player
        from public.players where user_id = new.id order by created_at limit 1;
    end if;
  end if;
  if my_player is null then return new; end if;

  for g in
    select id from public.players
    where user_id is null and merged_into is null and id <> my_player
      and public.normalize_phone(phone) = public.normalize_phone(new.phone)
  loop
    perform public.merge_players(my_player, g);
  end loop;
  return new;
end $$;


-- ------------------------------------------ reconcile 0016's link side-effect
-- 0016's link could have set guest.user_id to a profile that already had its own
-- player row, leaving two live rows per user_id. Collapse each such group into
-- its earliest row via the same tombstone mechanism. Idempotent.
do $$
declare r record; canonical uuid;
begin
  for r in
    select user_id from public.players
    where user_id is not null and merged_into is null
    group by user_id having count(*) > 1
  loop
    select id into canonical from public.players
      where user_id = r.user_id and merged_into is null
      order by created_at limit 1;
    update public.players
      set merged_into = canonical, user_id = null
      where user_id = r.user_id and id <> canonical and merged_into is null;
  end loop;
end $$;
