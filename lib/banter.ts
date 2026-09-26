// Little competitive nudges derived from the event log: rivalries, cold
// streaks and Tyler's record. All read-only; nothing here affects scoring.

import { COLD_AFTER_MS, CONFIG } from "./config";
import type { Player, PointEvent, Standing } from "./scoring";

export type Rivalry = { a: Player; b: Player; gap: number; total: number };

/** The highest-ranked pair of neighbours (with points) that are tied or one apart. */
export function topRivalry(standings: Standing[]): Rivalry | null {
  for (let i = 0; i + 1 < standings.length; i++) {
    const a = standings[i], b = standings[i + 1];
    if (b.total <= 0) break;
    const gap = a.total - b.total;
    if (gap <= 1) return { a: a.player, b: b.player, gap, total: a.total };
  }
  return null;
}

/**
 * Players with no win for COLD_AFTER_MS. Players who haven't won at all count
 * from the party's first event, so nobody is cold before the party has run
 * that long. Tyler's losses count as activity (he's clearly playing).
 */
export function coldPlayerIds(players: Player[], events: PointEvent[], now: number): Set<string> {
  if (events.length === 0) return new Set();
  const start = Math.min(...events.map((e) => Date.parse(e.created_at)));
  const last = new Map<string, number>();
  for (const e of events) {
    // only Tyler has losses logged, and a loss means he's still playing
    if (e.delta !== 0) last.set(e.player_id, Math.max(last.get(e.player_id) ?? 0, Date.parse(e.created_at)));
  }
  return new Set(players.filter((p) => now - (last.get(p.id) ?? start) > COLD_AFTER_MS).map((p) => p.id));
}

export type TylerRecord = {
  games: { game: string; wins: number; losses: number }[];
  lastWinAt: number | null;
  wins: number;
  losses: number;
};

export function tylerRecord(tyler: Player, events: PointEvent[]): TylerRecord {
  const mine = events.filter((e) => e.player_id === tyler.id);
  const games = CONFIG.games
    .map((game) => ({
      game,
      wins: mine.filter((e) => e.game === game && e.delta > 0).length,
      losses: mine.filter((e) => e.game === game && e.delta < 0).length,
    }))
    .filter((g) => g.wins + g.losses > 0);
  const winTimes = mine.filter((e) => e.delta > 0).map((e) => Date.parse(e.created_at));
  return {
    games,
    lastWinAt: winTimes.length ? Math.max(...winTimes) : null,
    wins: winTimes.length,
    losses: mine.filter((e) => e.delta < 0).length,
  };
}

/** "12 min", "1 hr 5 min" */
export function ago(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`;
}
