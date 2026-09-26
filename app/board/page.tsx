"use client";

import Link from "next/link";
import { DrinkStatus } from "@/components/DrinkVote";
import { Flame } from "@/components/Flame";
import { SoundToggle } from "@/components/SoundToggle";
import { Standings } from "@/components/Standings";
import { hotPlayerIds } from "@/lib/scoring";
import { useNow } from "@/lib/useNow";
import { prizeHolders, prizeRaces } from "@/lib/prizes";
import { useParty } from "@/lib/party";
import { usePlayerId } from "@/lib/usePlayerId";

export default function BoardPage() {
  const { raw, derived, error } = useParty();
  const myId = usePlayerId();
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
                <b className="display curse-title"><Flame /> {tyler.name} is cursed</b>
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
                in a row. Log his losses from the Report a win tab.
              </p>
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
      <DrinkStatus />

      <Standings
        standings={derived.standings}
        threshold={threshold}
        curse={curse}
        winnerId={winner?.id}
        myId={myId}
        hotIds={hotPlayerIds(raw.events, now)}
        prizes={prizeHolders(prizeRaces(players, raw.events))}
      />

      <Link href="/prizes" className="prizes-link">
        🏆 See the side prize races →
      </Link>

    </>
  );
}
