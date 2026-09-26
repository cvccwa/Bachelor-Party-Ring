-- "Tyler needs a drink" mechanic.
--  * Active players (non-Tyler, >= 1 win) may vote. Votes don't expire.
--  * Needed = max(2, floor(active / 2) + 1)  — a strict majority, floor of 2.
--  * Reaching it orders a drink (votes reset). While a drink is owed, Tyler's
--    wins are refused. One non-Tyler witness confirms he drank.
--  * Voting reopens 10 minutes after a confirmed drink.

create table public.drink_votes (
  player_id  uuid primary key references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.drink_orders (
  id         uuid primary key default gen_random_uuid(),
  ordered_at timestamptz not null default now(),
  drunk_at   timestamptz,
  witness_id uuid references public.players (id) on delete set null
);
-- at most one unpaid drink at a time
create unique index drink_orders_one_pending on public.drink_orders ((true)) where drunk_at is null;

alter table public.drink_votes  enable row level security;
alter table public.drink_orders enable row level security;
create policy "read drink votes"  on public.drink_votes  for select to anon, authenticated using (true);
create policy "read drink orders" on public.drink_orders for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.drink_votes, public.drink_orders from anon, authenticated;

create function private.drink_active_count() returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct e.player_id)::int
  from public.point_events e join public.players p on p.id = e.player_id
  where e.delta > 0 and not p.is_tyler
$$;

create function private.drink_needed() returns int
language sql stable security definer set search_path = '' as $$
  select greatest(2, private.drink_active_count() / 2 + 1)
$$;

create function private.assert_voter(p_player_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare t boolean;
begin
  select is_tyler into t from public.players where id = p_player_id;
  if not found then raise exception 'unknown_player' using errcode = 'P0001'; end if;
  if t then raise exception 'drink_tyler' using errcode = 'P0001'; end if;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;

-- Vote (or re-affirm). Returns votes / needed / whether a drink was just ordered.
create function public.vote_drink(p_player_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v int; n int; last_drunk timestamptz;
begin
  perform private.assert_open();
  perform private.assert_voter(p_player_id);
  perform pg_advisory_xact_lock(hashtext('tyler_drink'));
  if exists (select 1 from public.drink_orders where drunk_at is null) then
    raise exception 'drink_pending' using errcode = 'P0001';
  end if;
  select max(drunk_at) into last_drunk from public.drink_orders;
  if last_drunk is not null and last_drunk > now() - interval '10 minutes' then
    raise exception 'drink_cooldown' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.point_events where player_id = p_player_id and delta > 0) then
    raise exception 'drink_not_active' using errcode = 'P0001';
  end if;

  insert into public.drink_votes (player_id) values (p_player_id) on conflict do nothing;
  n := private.drink_needed();
  select count(*) into v from public.drink_votes dv
  where exists (select 1 from public.point_events e where e.player_id = dv.player_id and e.delta > 0);

  if v >= n then
    insert into public.drink_orders default values;
    delete from public.drink_votes where true;
    return jsonb_build_object('votes', v, 'needed', n, 'ordered', true);
  end if;
  return jsonb_build_object('votes', v, 'needed', n, 'ordered', false);
end $$;

create function public.unvote_drink(p_player_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.drink_votes where player_id = p_player_id;
end $$;

-- One witness (not Tyler) confirms the drink; Tyler's wins unlock.
create function public.confirm_drink(p_player_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_voter(p_player_id);
  perform pg_advisory_xact_lock(hashtext('tyler_drink'));
  update public.drink_orders set drunk_at = now(), witness_id = p_player_id where drunk_at is null;
  if not found then raise exception 'no_drink_pending' using errcode = 'P0001'; end if;
end $$;

-- Host: wipe pending drink + votes (for mis-taps).
create function public.admin_clear_drink(p_pin text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_pin(p_pin);
  delete from public.drink_votes where true;
  delete from public.drink_orders where drunk_at is null;
end $$;

-- report_win: also refuse Tyler's wins while he owes a drink.
create or replace function public.report_win(p_player_id uuid, p_game text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  new_id    uuid;
  is_tyler  boolean;
  game      text := btrim(p_game);
  last_game text;
begin
  perform private.assert_open();
  select p.is_tyler into is_tyler from public.players p where p.id = p_player_id;
  if not found then
    raise exception 'unknown_player' using errcode = 'P0001';
  end if;

  if is_tyler then
    perform pg_advisory_xact_lock(hashtext('tyler_lost'));
    if exists (select 1 from public.drink_orders where drunk_at is null) then
      raise exception 'drink_owed' using errcode = 'P0001';
    end if;
    if game <> 'Kahoot' then
      select e.game into last_game from public.point_events e
      where e.player_id = p_player_id order by e.seq desc limit 1;
      if last_game = game then
        raise exception 'tyler_repeat' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into public.point_events (player_id, game, delta)
  values (p_player_id, game, 1)
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.vote_drink(uuid), public.unvote_drink(uuid), public.confirm_drink(uuid), public.admin_clear_drink(text) from public;
grant execute on function public.vote_drink(uuid), public.unvote_drink(uuid), public.confirm_drink(uuid), public.admin_clear_drink(text) to anon, authenticated;

alter publication supabase_realtime add table public.drink_votes, public.drink_orders;
