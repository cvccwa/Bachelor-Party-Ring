"use client";

import { useState } from "react";
import { buzz } from "@/components/Burst";
import { GameIcon } from "@/components/GameIcon";
import { SidePrizes } from "@/components/SidePrizes";
import { SoundToggle } from "@/components/SoundToggle";
import { Standings } from "@/components/Standings";
import { useToast } from "@/components/Toast";
import { CONFIG, GAME_LABELS } from "@/lib/config";
import { hotPlayerIds } from "@/lib/scoring";
import { useNow } from "@/lib/useNow";
import { friendlyError, supabase } from "@/lib/supabase";
import { useParty } from "@/lib/party";
import { usePlayerId } from "@/lib/usePlayerId";

export default function BoardPage() {
  const { raw, derived, error, refresh } = useParty();
  const myId = usePlayerId();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useNow();

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
    buzz([60, 40, 140]);
    setBusy(true);
    const { data: eventId, error: err } = await supabase.rpc("tyler_lost", { p_game: game });
    setBusy(false);
    setSheet(false);
    if (err) {
      toast(friendlyError(err), { variant: "error" });
    } else {
      // The splash carries the flavor; this toast is just the Undo handle.
      toast("Tyler −1 logged", {
        variant: "curse",
        ms: 10_000,
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
      <div className="row">
        <h1>The Fellowship Standings</h1>
        <span className="spacer" />
        <SoundToggle />
      </div>
      <div className="runes" aria-hidden>
        ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ
      </div>
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

      <Standings
        standings={derived.standings}
        threshold={threshold}
        curse={curse}
        winnerId={winner?.id}
        myId={myId}
        hotIds={hotPlayerIds(raw.events, now)}
      />

      {derived.sidePrizes.length > 0 && (
        <>
          <h2>Side prizes</h2>
          <SidePrizes prizes={derived.sidePrizes} />
        </>
      )}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => !busy && setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Which game did Tyler lose?</h2>
            <div className="games">
              {CONFIG.games.map((g) => (
                <button key={g} className="game" disabled={busy} onClick={() => tylerLost(g)}>
                  <GameIcon game={g} size={30} />
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
