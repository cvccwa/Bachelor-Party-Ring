"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { CONFIG, GAME_ICONS, GAME_LABELS, SIDE_PRIZE_TITLES } from "@/lib/config";
import { tylerLostLine } from "@/lib/flavor";
import { rankTitle } from "@/lib/scoring";
import { friendlyError, supabase } from "@/lib/supabase";
import { useParty } from "@/lib/party";
import { usePlayerId } from "@/lib/usePlayerId";

export default function BoardPage() {
  const { raw, derived, error, refresh } = useParty();
  const myId = usePlayerId();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!raw || !derived) {
    return <p className="muted">{error ? `Can't reach the scoreboard: ${error}` : "Summoning the scoreboard…"}</p>;
  }

  const { settings, players } = raw;
  const threshold = settings.win_threshold;
  const ended = !!settings.ended_at;
  const tyler = derived.tyler;
  const curse = derived.curse;
  const winner = derived.grandWinner ? players.find((p) => p.id === derived.grandWinner!.playerId) : null;

  async function tylerLost(game: string) {
    setBusy(true);
    const { data: eventId, error: err } = await supabase.rpc("tyler_lost", { p_game: game });
    setBusy(false);
    setSheet(false);
    if (err) {
      toast(friendlyError(err), { variant: "error" });
    } else {
      toast(tylerLostLine(), {
        variant: "curse",
        action: {
          label: "Undo",
          onClick: async () => {
            const { data: ok } = await supabase.rpc("undo_event", { p_event_id: eventId });
            toast(ok ? "Undone — Tyler is spared." : "Too late to undo — ask the host.", {
              variant: ok ? "win" : "error",
            });
            void refresh().catch(() => {});
          },
        },
      });
    }
    void refresh().catch(() => {});
  }

  return (
    <>
      <h1>The Fellowship Standings</h1>
      <p className="sub">
        First to {threshold} is crowned.{ended && " The competition has ended."}
      </p>

      {winner && (
        <div className="banner">
          👑 {winner.name} is the grand winner
          {derived.grandWinner!.reason === "fallback" ? " (highest total when the host called it)" : ""}!
        </div>
      )}

      {tyler && curse.status !== "disabled" && (
        <section className={`curse ${curse.status === "lifted" ? "lifted" : ""}`}>
          {curse.status === "cursed" ? (
            <>
              <div className="row">
                <b className="display">🔥 {tyler.name} is cursed</b>
                <span className="spacer" />
                <span className="muted">
                  Streak{" "}
                  <span className="streak" aria-label={`${curse.streak} of ${settings.tyler_streak_length}`}>
                    {Array.from({ length: settings.tyler_streak_length }, (_, i) => (
                      <i key={i} className={i < curse.streak ? "on" : ""} />
                    ))}
                  </span>
                </span>
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Every loss costs him 1. The ring returns at {threshold} points or {settings.tyler_streak_length} wins
                in a row.
              </p>
              <button className="btn btn-ember big" disabled={ended || busy} onClick={() => setSheet(true)}>
                TYLER LOST
              </button>
            </>
          ) : (
            <>
              <b className="display">💍 The ring has returned to {tyler.name}</b>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Curse broken by {curse.reason === "streak" ? "a winning streak" : `reaching ${threshold} points`}.
                His losses are free now.
              </p>
            </>
          )}
        </section>
      )}

      <ol className="board">
        {derived.standings.map((s) => {
          const isCursed = s.player.is_tyler && curse.status === "cursed";
          const pct = Math.max(0, Math.min(100, (s.total / threshold) * 100));
          return (
            <li
              key={s.player.id}
              className={[
                s.rank === 1 && s.total > 0 ? "top" : "",
                isCursed ? "cursed" : "",
                s.player.id === myId ? "me-row" : "",
              ].join(" ")}
            >
              <span className="rank">{s.rank}</span>
              <span className="who">
                <b>
                  {winner?.id === s.player.id && "👑 "}
                  {s.player.name}
                  {isCursed && " 🔥"}
                </b>
                <span className="row" style={{ gap: 6 }}>
                  <span className={`chip ${s.total >= threshold ? "chip-gold" : ""}`}>
                    {rankTitle(s.total, threshold)}
                  </span>
                  {s.player.is_tyler && curse.status === "lifted" && <span className="chip chip-elf">Ring back</span>}
                  {s.losses > 0 && <span className="chip chip-ember">−{s.losses}</span>}
                </span>
                <span className="progress">
                  <span style={{ width: `${pct}%` }} />
                </span>
              </span>
              <span className={`pts ${s.total < 0 ? "neg" : ""}`}>{s.total}</span>
            </li>
          );
        })}
      </ol>

      {derived.sidePrizes.length > 0 && (
        <>
          <h2>Side prizes</h2>
          <div className="prizes">
            {CONFIG.games
              .map((g) => derived.sidePrizes.find((p) => p.game === g))
              .filter((p) => !!p)
              .map((p) => (
                <div key={p.game} className="panel prize">
                  <span className="prize-game muted">
                    {GAME_ICONS[p.game] ?? "🏆"} {GAME_LABELS[p.game] ?? p.game}
                  </span>
                  <b className="prize-title">{SIDE_PRIZE_TITLES[p.game] ?? `${p.game} champion`}</b>
                  <span>{p.leaders.map((l) => l.name).join(", ")}</span>{" "}
                  <span className="muted">
                    · {p.wins} win{p.wins === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => !busy && setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Which game did Tyler lose?</h2>
            <div className="games">
              {CONFIG.games.map((g) => (
                <button key={g} className="game" disabled={busy} onClick={() => tylerLost(g)}>
                  <span aria-hidden>{GAME_ICONS[g] ?? "🏆"}</span>
                  {GAME_LABELS[g] ?? g}
                </button>
              ))}
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={() => setSheet(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
