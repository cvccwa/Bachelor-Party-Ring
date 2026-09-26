// Big-moment detection for the live splashes and the "while you were away"
// recap. Both compare the party as this phone last saw it (events up to
// `seen.seq`, under the settings it saw then) with the party now, using the
// same derive() the leaderboard uses. Comparing settings too catches crowns
// that come from the host (ending the competition, lowering the threshold).

import { mastery } from "./prizes";
import { derive, rankTitle, type Derived, type Player, type PointEvent, type Settings } from "./scoring";

export type Moment =
  | { kind: "crowned"; playerName: string; fallback: boolean }
  | { kind: "ringBack"; reason: "threshold" | "streak" }
  | { kind: "tylerLost"; game: string; eventId: string }
  | { kind: "throne"; playerName: string; mine: boolean }
  | { kind: "gollum"; on: boolean }
  | { kind: "mastery"; playerName: string; mine: boolean }
  | { kind: "rankUp"; title: string }
  | { kind: "drinkOrdered" }
  | { kind: "drinkDone"; witness: string | null };

// Rank titles in ascending order, for detecting a personal level-up.
const TITLE_ORDER = ["Lost in the Marshes", "Hobbit", "Ranger", "Elf-lord", "Crowned"];

export type Recap = {
  wins: number;
  tylerLosses: number;
  leader: { name: string; total: number } | null;
  moments: Moment[];
};

export function detectMoments(
  players: Player[],
  events: PointEvent[],
  settings: Settings,
  seen: { seq: number; settings: Settings },
  myId?: string | null,
): { moments: Moment[]; recap: Recap; newCount: number } {
  const fresh = events.filter((e) => e.seq > seen.seq).sort((a, b) => a.seq - b.seq);
  const before = derive(players, events.filter((e) => e.seq <= seen.seq), seen.settings);
  const after = derive(players, events, settings);
  const tyler = after.tyler;

  const moments: Moment[] = [];
  for (const e of fresh) {
    if (tyler && e.player_id === tyler.id && e.delta < 0) moments.push({ kind: "tylerLost", game: e.game, eventId: e.id });
  }
  if (before.curse.status === "cursed" && after.curse.status === "lifted") {
    moments.push({ kind: "ringBack", reason: after.curse.reason });
  }
  if (!before.grandWinner && after.grandWinner) {
    const name = players.find((p) => p.id === after.grandWinner!.playerId)?.name ?? "Someone";
    moments.push({ kind: "crowned", playerName: name, fallback: after.grandWinner.reason === "fallback" });
  }

  // Gollum mode flips when Tyler crosses zero.
  if (tyler) {
    const was = before.totals.get(tyler.id) ?? 0, now = after.totals.get(tyler.id) ?? 0;
    if (was >= 0 && now < 0) moments.push({ kind: "gollum", on: true });
    if (was < 0 && now >= 0) moments.push({ kind: "gollum", on: false });
  }

  const m0 = mastery(players, events.filter((e) => e.seq <= seen.seq)).master;
  const m1 = mastery(players, events).master;
  if (!m0 && m1) moments.push({ kind: "mastery", playerName: m1.name, mine: m1.id === myId });

  // Personal level-up for this phone's player (skipped if they were just crowned).
  if (myId && !moments.some((m) => m.kind === "crowned" && after.grandWinner?.playerId === myId)) {
    const was = rankTitle(before.totals.get(myId) ?? 0, seen.settings.win_threshold);
    const now = rankTitle(after.totals.get(myId) ?? 0, settings.win_threshold);
    if (TITLE_ORDER.indexOf(now) > TITLE_ORDER.indexOf(was)) moments.push({ kind: "rankUp", title: now });
  }

  const top = after.standings[0];
  return {
    moments,
    newCount: fresh.length,
    recap: {
      wins: fresh.filter((e) => e.delta > 0).length,
      tylerLosses: fresh.filter((e) => tyler && e.player_id === tyler.id && e.delta < 0).length,
      leader: top && top.total > 0 ? { name: top.player.name, total: top.total } : null,
      moments,
    },
  };
}

// Drink orders as a phone last saw them: the latest order's id and whether it
// had been drunk. Kept alongside `seen` so reopening the app recaps them too.
export type DrinkSeen = { id: string; orderedAt: string; drunk: boolean } | null;
type OrderRow = { id: string; ordered_at: string; drunk_at: string | null; witness_id: string | null };

export function drinkSeen(order: OrderRow | null): DrinkSeen {
  return order ? { id: order.id, orderedAt: order.ordered_at, drunk: !!order.drunk_at } : null;
}

export function detectDrink(before: DrinkSeen | undefined, order: OrderRow | null, players: Player[]): Moment[] {
  if (before === undefined || !order) return []; // no record yet: don't guess
  const out: Moment[] = [];
  const isNew = !before || (order.id !== before.id && Date.parse(order.ordered_at) > Date.parse(before.orderedAt));
  // A newer order since we looked (it may already have been drunk, too).
  if (isNew) out.push({ kind: "drinkOrdered" });
  // Drunk since we looked. (An older order resurfacing after the host clears
  // a pending one is neither new nor newly drunk.)
  if (order.drunk_at && (isNew || (order.id === before?.id && !before.drunk))) {
    out.push({ kind: "drinkDone", witness: players.find((p) => p.id === order.witness_id)?.name ?? null });
  }
  return out;
}

// The throne: whoever is alone at the top. A phone remembers the last sole
// leader it saw, so a lead that changes hands through a tie still counts.
export function soleLeader(d: Derived): string | null {
  const [a, b] = d.standings;
  return a && a.total > 0 && (!b || b.total < a.total) ? a.player.id : null;
}

export function detectThrone(
  prevThrone: string | null | undefined,
  players: Player[],
  events: PointEvent[],
  settings: Settings,
  myId?: string | null,
): { throne: string | null; moment: Moment | null } {
  const d = derive(players, events, settings);
  const lead = soleLeader(d);
  const throne = lead ?? prevThrone ?? null;
  // undefined = no record yet (first visit / older app version): don't guess
  if (!lead || prevThrone === undefined || prevThrone === null || lead === prevThrone || d.grandWinner) {
    return { throne, moment: null };
  }
  const name = players.find((p) => p.id === lead)?.name ?? "Someone";
  return { throne, moment: { kind: "throne", playerName: name, mine: lead === myId } };
}
