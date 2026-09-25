// Big-moment detection for the live splashes and the "while you were away"
// recap. Both compare the party as this phone last saw it (events up to
// `seen.seq`, under the settings it saw then) with the party now, using the
// same derive() the leaderboard uses. Comparing settings too catches crowns
// that come from the host (ending the competition, lowering the threshold).

import { derive, rankTitle, type Player, type PointEvent, type Settings } from "./scoring";

export type Moment =
  | { kind: "crowned"; playerName: string; fallback: boolean }
  | { kind: "ringBack"; reason: "threshold" | "streak" }
  | { kind: "tylerLost"; game: string }
  | { kind: "rankUp"; title: string };

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
    if (tyler && e.player_id === tyler.id && e.delta < 0) moments.push({ kind: "tylerLost", game: e.game });
  }
  if (before.curse.status === "cursed" && after.curse.status === "lifted") {
    moments.push({ kind: "ringBack", reason: after.curse.reason });
  }
  if (!before.grandWinner && after.grandWinner) {
    const name = players.find((p) => p.id === after.grandWinner!.playerId)?.name ?? "Someone";
    moments.push({ kind: "crowned", playerName: name, fallback: after.grandWinner.reason === "fallback" });
  }

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
