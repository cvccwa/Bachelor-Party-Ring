// End-of-party numbers for the Hall of Legends screen.
import type { Derived, PointEvent, Standing } from "./scoring";

export type TylerTale = {
  name: string;
  total: number;
  wins: number;
  losses: number;
  bestStreak: number;
  worstGame: { game: string; losses: number } | null;
  curse: Derived["curse"];
};

export function podium(standings: Standing[]): Standing[][] {
  // Up to three steps; players tied on points share a step.
  const steps: Standing[][] = [];
  for (const s of standings) {
    if (s.total <= 0) break;
    const last = steps[steps.length - 1];
    if (last && last[0].total === s.total) last.push(s);
    else if (steps.length < 3) steps.push([s]);
    else break;
  }
  return steps;
}

export function tylerTale(derived: Derived, events: PointEvent[]): TylerTale | null {
  const t = derived.tyler;
  if (!t) return null;
  const mine = events.filter((e) => e.player_id === t.id).sort((a, b) => a.seq - b.seq);
  let streak = 0;
  let best = 0;
  const lostAt = new Map<string, number>();
  for (const e of mine) {
    if (e.delta > 0) best = Math.max(best, ++streak);
    else {
      streak = 0;
      lostAt.set(e.game, (lostAt.get(e.game) ?? 0) + 1);
    }
  }
  const worst = [...lostAt].sort((a, b) => b[1] - a[1])[0];
  return {
    name: t.name,
    total: derived.totals.get(t.id) ?? 0,
    wins: mine.filter((e) => e.delta > 0).length,
    losses: mine.filter((e) => e.delta < 0).length,
    bestStreak: best,
    worstGame: worst ? { game: worst[0], losses: worst[1] } : null,
    curse: derived.curse,
  };
}
