// Everything on the leaderboard is derived from point_events on read — no
// stored totals. Replays events in `seq` order (strict insertion order).
// The ring-back replay mirrors private.tyler_ring_back() in the migration.

export type Player = { id: string; name: string; is_tyler: boolean; sort_order: number };
export type PointEvent = {
  id: string;
  seq: number;
  player_id: string;
  game: string;
  delta: number;
  created_at: string;
};
export type Settings = {
  win_threshold: number;
  tyler_streak_length: number;
  curse_enabled: boolean;
  ended_at: string | null;
};

export type CurseState =
  | { status: "disabled" }
  | { status: "cursed"; streak: number }
  | { status: "lifted"; reason: "threshold" | "streak"; at: string };

export type GrandWinner = {
  playerId: string;
  reason: "threshold" | "fallback";
  at: string;
};

export type Standing = {
  player: Player;
  total: number;
  wins: number;
  losses: number;
  rank: number; // 1-based, ties share a rank
};

export type SidePrize = { game: string; leaders: Player[]; wins: number };

export type Derived = {
  standings: Standing[];
  totals: Map<string, number>;
  grandWinner: GrandWinner | null;
  tyler: Player | null;
  curse: CurseState;
  sidePrizes: SidePrize[];
};

export function derive(players: Player[], events: PointEvent[], settings: Settings): Derived {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const byId = new Map(players.map((p) => [p.id, p]));
  const totals = new Map<string, number>(players.map((p) => [p.id, 0]));
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  // when each player's running total first reached its current final value (fallback tie-break)
  const reachedAt = new Map<string, number>();

  let grandWinner: GrandWinner | null = null;
  const tyler = players.find((p) => p.is_tyler) ?? null;

  let tylerTotal = 0;
  let tylerStreak = 0;
  let lifted: CurseState | null = null;

  for (const e of ordered) {
    if (!byId.has(e.player_id)) continue;
    const t = (totals.get(e.player_id) ?? 0) + e.delta;
    totals.set(e.player_id, t);
    const bucket = e.delta > 0 ? wins : losses;
    bucket.set(e.player_id, (bucket.get(e.player_id) ?? 0) + 1);

    if (!grandWinner && t >= settings.win_threshold) {
      grandWinner = { playerId: e.player_id, reason: "threshold", at: e.created_at };
    }

    if (tyler && e.player_id === tyler.id && !lifted) {
      tylerTotal += e.delta;
      tylerStreak = e.delta > 0 ? tylerStreak + 1 : 0;
      if (tylerTotal >= settings.win_threshold) {
        lifted = { status: "lifted", reason: "threshold", at: e.created_at };
      } else if (tylerStreak >= settings.tyler_streak_length) {
        lifted = { status: "lifted", reason: "streak", at: e.created_at };
      }
    }
  }

  // Recompute "reached final total at" in a second pass now that finals are known.
  {
    const running = new Map<string, number>();
    for (const e of ordered) {
      const r = (running.get(e.player_id) ?? 0) + e.delta;
      running.set(e.player_id, r);
      if (r === totals.get(e.player_id) && !reachedAt.has(e.player_id)) reachedAt.set(e.player_id, e.seq);
      if (r !== totals.get(e.player_id)) reachedAt.delete(e.player_id);
    }
  }

  const sorted = [...players].sort((a, b) => {
    const d = (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0);
    if (d !== 0) return d;
    const ra = reachedAt.get(a.id) ?? Infinity;
    const rb = reachedAt.get(b.id) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return a.sort_order - b.sort_order;
  });

  // Fallback (host "End competition"): highest total wins; earliest to reach it breaks ties.
  if (!grandWinner && settings.ended_at && sorted.length > 0 && ordered.length > 0) {
    grandWinner = { playerId: sorted[0].id, reason: "fallback", at: settings.ended_at };
  }

  let rank = 0;
  let prev: number | null = null;
  const standings = sorted.map((p, i) => {
    const total = totals.get(p.id) ?? 0;
    if (total !== prev) rank = i + 1;
    prev = total;
    return { player: p, total, wins: wins.get(p.id) ?? 0, losses: losses.get(p.id) ?? 0, rank };
  });

  let curse: CurseState;
  if (!settings.curse_enabled) curse = { status: "disabled" };
  else if (lifted) curse = lifted;
  else curse = { status: "cursed", streak: tylerStreak };

  return { standings, totals, grandWinner, tyler, curse, sidePrizes: sidePrizes(players, ordered) };
}

// Per-game side prizes: most wins (+1 events) per game.
function sidePrizes(players: Player[], events: PointEvent[]): SidePrize[] {
  const counts = new Map<string, Map<string, number>>();
  for (const e of events) {
    if (e.delta <= 0) continue;
    const g = counts.get(e.game) ?? new Map<string, number>();
    g.set(e.player_id, (g.get(e.player_id) ?? 0) + 1);
    counts.set(e.game, g);
  }
  const byId = new Map(players.map((p) => [p.id, p]));
  const out: SidePrize[] = [];
  for (const [game, g] of counts) {
    const max = Math.max(...g.values());
    const leaders = [...g.entries()]
      .filter(([, n]) => n === max)
      .map(([id]) => byId.get(id))
      .filter((p): p is Player => !!p);
    out.push({ game, leaders, wins: max });
  }
  return out;
}

// Original LOTR-flavored rank titles, scaled to the live threshold
// (the spec's 0-2 / 3-4 / 5-6 / 7+ bands at threshold 7).
export function rankTitle(total: number, threshold: number): string {
  if (total < 0) return "Lost in the Marshes";
  if (total >= threshold) return "Crowned";
  const f = total / threshold;
  if (f >= 5 / 7) return "Elf-lord";
  if (f >= 3 / 7) return "Ranger";
  return "Hobbit";
}
