// "Tyler needs a drink" state, mirroring the SQL rules in
// supabase/migrations/20260926010000_tyler_drink_votes.sql:
//  * voters are non-Tyler players who have logged at least one win
//  * needed = max(2, floor(voters / 2) + 1)
//  * while a drink is owed Tyler can't log wins; one witness clears it
//  * voting reopens 10 minutes after the drink is confirmed

import type { Raw } from "./party";

export const DRINK_COOLDOWN_MS = 10 * 60_000;

export type DrinkState = {
  pending: boolean;
  votes: number;
  needed: number;
  voterIds: Set<string>; // players eligible to vote
  votedIds: Set<string>; // eligible players who have voted
  cooldownUntil: number | null; // ms timestamp, only while in the future
};

export function drinkState(raw: Raw, now: number): DrinkState {
  const tylerIds = new Set(raw.players.filter((p) => p.is_tyler).map((p) => p.id));
  const voterIds = new Set(raw.events.filter((e) => e.delta > 0 && !tylerIds.has(e.player_id)).map((e) => e.player_id));
  const votedIds = new Set(raw.drinkVotes.map((v) => v.player_id).filter((id) => voterIds.has(id)));
  const order = raw.drinkOrder;
  const pending = !!order && !order.drunk_at;
  const until = order?.drunk_at ? Date.parse(order.drunk_at) + DRINK_COOLDOWN_MS : null;
  return {
    pending,
    votes: votedIds.size,
    needed: Math.max(2, Math.floor(voterIds.size / 2) + 1),
    voterIds,
    votedIds,
    cooldownUntil: until && until > now ? until : null,
  };
}
