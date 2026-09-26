// Per-game prize race for the Prizes tab: who holds each title (most wins,
// ties share it) and who is next in line behind them.
import { CONFIG } from "./config";
import type { Player, PointEvent } from "./scoring";

export type PrizeRace = {
  game: string;
  holders: Player[];
  wins: number;
  chasers: Player[];
  chaserWins: number;
};

export function prizeRaces(players: Player[], events: PointEvent[]): PrizeRace[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return CONFIG.games.map((game) => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.game === game && e.delta > 0 && byId.has(e.player_id)) {
        counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
      }
    }
    const levels = [...new Set(counts.values())].sort((a, b) => b - a);
    const at = (n: number | undefined) =>
      n === undefined ? [] : [...counts].filter(([, c]) => c === n).map(([id]) => byId.get(id)!);
    return { game, holders: at(levels[0]), wins: levels[0] ?? 0, chasers: at(levels[1]), chaserWins: levels[1] ?? 0 };
  });
}

/** player id → games whose side prize they currently hold. */
export function prizeHolders(races: PrizeRace[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of races) for (const p of r.holders) out.set(p.id, [...(out.get(p.id) ?? []), r.game]);
  return out;
}
