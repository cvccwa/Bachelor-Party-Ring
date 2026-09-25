-- Bachelor Party Ring Tracker: schema, security, RPCs, seed.
--
-- Security model (no user auth, per spec):
--   * RLS is on for every table; anon/authenticated can only SELECT.
--   * All writes go through SECURITY DEFINER functions below, which validate input.
--   * Host actions additionally require the shared PIN, stored hashed in the
--     non-exposed `private` schema. The PIN is NOT set here — see README.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- tables

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 1 and 30),
  is_tyler    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
-- exactly one Tyler
create unique index players_one_tyler on public.players (is_tyler) where is_tyler;

create table public.point_events (
  id          uuid primary key default gen_random_uuid(),
  -- seq gives a strict, tie-free event order (created_at can collide within a transaction)
  seq         bigint generated always as identity unique,
  player_id   uuid not null references public.players (id) on delete cascade,
  game        text not null check (char_length(game) between 1 and 40),
  delta       int  not null check (delta in (-1, 1)),
  created_at  timestamptz not null default now()
);
create index point_events_player_seq on public.point_events (player_id, seq);

-- Single-row, host-tunable settings (games list stays in app config).
create table public.settings (
  id                   int primary key default 1 check (id = 1),
  win_threshold        int not null default 7 check (win_threshold between 1 and 100),
  tyler_streak_length  int not null default 3 check (tyler_streak_length between 1 and 50),
  curse_enabled        boolean not null default true,
  ended_at             timestamptz,
  updated_at           timestamptz not null default now()
);

create table private.admin (
  id        int primary key default 1 check (id = 1),
  pin_hash  text not null
);

-- ---------------------------------------------------------------- RLS

alter table public.players      enable row level security;
alter table public.point_events enable row level security;
alter table public.settings     enable row level security;

create policy "read players"  on public.players      for select to anon, authenticated using (true);
create policy "read events"   on public.point_events for select to anon, authenticated using (true);
create policy "read settings" on public.settings     for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.players, public.point_events, public.settings
  from anon, authenticated;

-- ---------------------------------------------------------------- helpers

-- Replays Tyler's events with current settings. True once the curse has lifted
-- (total hit the threshold OR win streak hit the streak length), or if the
-- mechanic is disabled. Mirrors lib/scoring.ts.
create function private.tyler_ring_back() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  s      public.settings;
  t_id   uuid;
  total  int := 0;
  streak int := 0;
  e      record;
begin
  select * into s from public.settings where id = 1;
  if not s.curse_enabled then return true; end if;
  select id into t_id from public.players where is_tyler;
  if t_id is null then return true; end if;
  for e in select delta from public.point_events where player_id = t_id order by seq loop
    total := total + e.delta;
    if e.delta > 0 then streak := streak + 1; else streak := 0; end if;
    if total >= s.win_threshold or streak >= s.tyler_streak_length then
      return true;
    end if;
  end loop;
  return false;
end $$;

create function private.assert_open() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select ended_at from public.settings where id = 1) is not null then
    raise exception 'competition_ended' using errcode = 'P0001';
  end if;
end $$;

create function private.assert_pin(p_pin text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_pin is null or not exists (
    select 1 from private.admin a
    where a.pin_hash = extensions.crypt(p_pin, a.pin_hash)
  ) then
    raise exception 'bad_pin' using errcode = 'P0001';
  end if;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- player RPCs

create function public.report_win(p_player_id uuid, p_game text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare new_id uuid;
begin
  perform private.assert_open();
  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'unknown_player' using errcode = 'P0001';
  end if;
  insert into public.point_events (player_id, game, delta)
  values (p_player_id, btrim(p_game), 1)
  returning id into new_id;
  return new_id;
end $$;

-- Communal button: anyone can log a Tyler loss. Only costs a point while cursed.
create function public.tyler_lost(p_game text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare t_id uuid; new_id uuid;
begin
  perform private.assert_open();
  -- serialize concurrent taps so the curse check sees prior losses
  perform pg_advisory_xact_lock(hashtext('tyler_lost'));
  if private.tyler_ring_back() then
    raise exception 'curse_lifted' using errcode = 'P0001';
  end if;
  select id into t_id from public.players where is_tyler;
  insert into public.point_events (player_id, game, delta)
  values (t_id, btrim(p_game), -1)
  returning id into new_id;
  return new_id;
end $$;

-- Undo a mis-tap: only very recent events (60s), so the toast "Undo" works
-- without the host PIN. Older fixes go through the host panel.
create function public.undo_event(p_event_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.point_events
  where id = p_event_id and created_at > now() - interval '60 seconds';
  return found;
end $$;

-- ---------------------------------------------------------------- host RPCs

create function public.admin_check_pin(p_pin text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_pin(p_pin);
  return true;
end $$;

create function public.admin_delete_event(p_pin text, p_event_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_pin(p_pin);
  delete from public.point_events where id = p_event_id;
  return found;
end $$;

create function public.admin_update_settings(
  p_pin text, p_win_threshold int, p_tyler_streak_length int, p_curse_enabled boolean
) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_pin(p_pin);
  update public.settings set
    win_threshold       = p_win_threshold,
    tyler_streak_length = p_tyler_streak_length,
    curse_enabled       = p_curse_enabled,
    updated_at          = now()
  where id = 1;
end $$;

-- p_ended = true: EndCompetition() fallback (highest total wins, derived client-side).
-- p_ended = false: reopen.
create function public.admin_set_ended(p_pin text, p_ended boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_pin(p_pin);
  update public.settings
  set ended_at = case when p_ended then now() else null end, updated_at = now()
  where id = 1;
end $$;

-- Add (p_id null) or rename a player, for the spare roster slots.
create function public.admin_upsert_player(p_pin text, p_id uuid, p_name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare out_id uuid;
begin
  perform private.assert_pin(p_pin);
  if p_id is null then
    if (select count(*) from public.players) >= 16 then
      raise exception 'roster_full' using errcode = 'P0001';
    end if;
    insert into public.players (name, sort_order)
    values (btrim(p_name), coalesce((select max(sort_order) from public.players), 0) + 1)
    returning id into out_id;
  else
    update public.players set name = btrim(p_name) where id = p_id returning id into out_id;
  end if;
  return out_id;
end $$;

revoke all on function
  public.report_win(uuid, text),
  public.tyler_lost(text),
  public.undo_event(uuid),
  public.admin_check_pin(text),
  public.admin_delete_event(text, uuid),
  public.admin_update_settings(text, int, int, boolean),
  public.admin_set_ended(text, boolean),
  public.admin_upsert_player(text, uuid, text)
from public;
grant execute on function
  public.report_win(uuid, text),
  public.tyler_lost(text),
  public.undo_event(uuid),
  public.admin_check_pin(text),
  public.admin_delete_event(text, uuid),
  public.admin_update_settings(text, int, int, boolean),
  public.admin_set_ended(text, boolean),
  public.admin_upsert_player(text, uuid, text)
to anon, authenticated;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.players, public.point_events, public.settings;

-- ---------------------------------------------------------------- seed

insert into public.settings (id) values (1);

insert into public.players (name, is_tyler, sort_order) values
  ('William',  false,  1),
  ('Tyler',    true,   2),
  ('Brian',    false,  3),
  ('Nick',     false,  4),
  ('Jeremy',   false,  5),
  ('Eliot',    false,  6),
  ('Emma',     false,  7),
  ('Jared',    false,  8),
  ('Drew',     false,  9),
  ('Wil',      false, 10),
  ('Shiliang', false, 11),
  ('Jennie',   false, 12),
  ('Wyatt',    false, 13),
  ('Yaz',      false, 14);
