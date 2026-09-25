import { GameIcon } from "@/components/GameIcon";
import { CONFIG, GAME_LABELS, SIDE_PRIZE_TITLES } from "@/lib/config";
import type { SidePrize } from "@/lib/scoring";

export function SidePrizes({ prizes }: { prizes: SidePrize[] }) {
  return (
    <div className="prizes">
      {CONFIG.games
        .map((g) => prizes.find((p) => p.game === g))
        .filter((p) => !!p)
        .map((p) => (
          <div key={p.game} className="panel prize">
            <span className="prize-game muted">
              <GameIcon game={p.game} size={16} className="inline-icon" /> {GAME_LABELS[p.game] ?? p.game}
            </span>
            <b className="prize-title">{SIDE_PRIZE_TITLES[p.game] ?? `${p.game} champion`}</b>
            <span>{p.leaders.map((l) => l.name).join(", ")}</span>{" "}
            <span className="muted">
              · {p.wins} win{p.wins === 1 ? "" : "s"}
            </span>
          </div>
        ))}
    </div>
  );
}
