-- "Curse spin": every time Tyler loses while cursed, the wheel picks a
-- penalty. The pick happens here (a trigger on the loss event) so every
-- screen shows the same result. Any non-Tyler player confirms he did it.
-- Undoing or deleting the loss removes its penalty (cascade).

create table public.tyler_penalties (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null unique references public.point_events (id) on delete cascade,
  penalty    text not null,
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  witness_id uuid references public.players (id) on delete set null
);

alter table public.tyler_penalties enable row level security;
create policy "read tyler penalties" on public.tyler_penalties for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.tyler_penalties from anon, authenticated;

-- Keep in sync with PENALTIES in lib/config.ts (the wheel's segments).
create function private.penalty_list() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'Switch hands for your next game',
    'Wear the silly hat',
    'Take a drink',
    'Gollum voice for 5 minutes',
    'Bow to the leader',
    'Toast whoever beat you',
    'Say "my precious" before your next turn',
    'Narrate your next game like Gandalf'
  ]
$$;

create function private.spin_penalty() returns trigger
language plpgsql security definer set search_path = '' as $$
declare list text[]; last text; pick text;
begin
  if new.delta >= 0 then return new; end if;
  select penalty into last from public.tyler_penalties order by created_at desc limit 1;
  -- never the same penalty twice in a row
  select array_agg(x) into list from unnest(private.penalty_list()) x where x is distinct from last;
  pick := list[1 + floor(random() * array_length(list, 1))::int];
  insert into public.tyler_penalties (event_id, penalty) values (new.id, pick);
  return new;
end $$;

create trigger point_events_spin_penalty
after insert on public.point_events
for each row execute function private.spin_penalty();

revoke all on all functions in schema private from public, anon, authenticated;

-- A witness (not Tyler) confirms a penalty was done.
create function public.confirm_penalty(p_player_id uuid, p_penalty_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_voter(p_player_id);
  update public.tyler_penalties set done_at = now(), witness_id = p_player_id
  where id = p_penalty_id and done_at is null;
  if not found then raise exception 'no_penalty_pending' using errcode = 'P0001'; end if;
end $$;

revoke all on function public.confirm_penalty(uuid, uuid) from public;
grant execute on function public.confirm_penalty(uuid, uuid) to anon, authenticated;

alter publication supabase_realtime add table public.tyler_penalties;
