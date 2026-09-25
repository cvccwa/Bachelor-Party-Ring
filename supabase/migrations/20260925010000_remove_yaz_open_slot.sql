-- Free up a roster slot: Yaz is no longer pre-seeded. The host fills the
-- open slots (16 max) from /host → Roster → "Add a guest…".
-- Only removes the row if Yaz has no scored events.
delete from public.players
where name = 'Yaz'
  and not exists (select 1 from public.point_events e where e.player_id = players.id);
