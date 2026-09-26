-- House rule: Tyler earns no point for winning the same game he last played.
-- "Last played" = his most recent logged result, win or loss. Kahoot is exempt
-- (placements take several taps in a row). A refused win isn't logged, so his
-- curse-lifting streak is unchanged. Mirrors TYLER_REPEAT_EXEMPT in lib/config.ts.
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
    -- same lock as tyler_lost, so a win and a loss can't race each other
    perform pg_advisory_xact_lock(hashtext('tyler_lost'));
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
