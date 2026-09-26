"use client";

import { GameIcon } from "@/components/GameIcon";
import { GAME_LABELS, MASTERY_TITLE, SIDE_PRIZE_TITLES } from "@/lib/config";
import { useParty } from "@/lib/party";
import { mastery, prizeRaces } from "@/lib/prizes";
import { usePlayerId } from "@/lib/usePlayerId";

// Side prizes: most wins in each game takes the title (ties share it).
export default function PrizesPage() {
  const { raw, error } = useParty();
  const myId = usePlayerId();

  if (!raw) {
    return <p className="muted">{error ? `Can't reach the scoreboard: ${error}` : "Summoning the scoreboard…"}</p>;
  }

  const races = prizeRaces(raw.players, raw.events);
  const m = mastery(raw.players, raw.events);
  const names = (ps: { name: string }[]) => ps.map((p) => p.name).join(" & ");

  return (
    <>
      <h1>Side Prizes</h1>
      <p className="sub">Most wins in each game takes the title. Ties share it.</p>

      <div className="prize-race">
        <div className={`race-card master ${m.master?.id === myId ? "mine" : ""} ${m.master ? "" : "open"}`}>
          <span className="race-icon" style={{ fontSize: 28 }}>🧭</span>
          <div className="race-body">
            <span className="race-game">Win every game once</span>
            <b className="race-title">{MASTERY_TITLE}</b>
            {m.master ? (
              <span>
                {m.master.name}
                {m.master.id === myId && <span className="chip chip-prize race-you">You</span>}
              </span>
            ) : (
              <span className="muted race-next">
                {m.closest.length > 0
                  ? `Closest: ${names(m.closest)} · ${m.closestCount} of ${m.total} games`
                  : `Unclaimed. First to win all ${m.total} takes it for good.`}
              </span>
            )}
          </div>
          <span className="race-wins">
            {m.master ? "🏅" : `${m.closestCount}/${m.total}`}
          </span>
        </div>
        {races.map((r) => {
          const title = SIDE_PRIZE_TITLES[r.game] ?? `${r.game} champion`;
          const mine = r.holders.some((p) => p.id === myId);
          if (r.holders.length === 0) {
            return (
              <div key={r.game} className="race-card open">
                <GameIcon game={r.game} size={30} className="race-icon" />
                <div className="race-body">
                  <span className="race-game">{GAME_LABELS[r.game] ?? r.game}</span>
                  <b className="race-title">{title}</b>
                  <span className="muted">Unclaimed. Win a round to take it.</span>
                </div>
                <span className="race-wins muted">–</span>
              </div>
            );
          }
          return (
            <div key={r.game} className={`race-card ${mine ? "mine" : ""}`}>
              <GameIcon game={r.game} size={30} className="race-icon" />
              <div className="race-body">
                <span className="race-game">{GAME_LABELS[r.game] ?? r.game}</span>
                <b className="race-title">{title}</b>
                <span>
                  {names(r.holders)}
                  {mine && <span className="chip chip-prize race-you">You</span>}
                </span>
                <span className="muted race-next">
                  {r.holders.length > 1
                    ? "Tied. One more win takes it outright."
                    : r.chasers.length > 0
                      ? `Next: ${names(r.chasers)} · ${r.chaserWins} win${r.chaserWins === 1 ? "" : "s"}`
                      : "No challengers yet."}
                </span>
              </div>
              <span className="race-wins">
                {r.wins}
                <small>win{r.wins === 1 ? "" : "s"}</small>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
