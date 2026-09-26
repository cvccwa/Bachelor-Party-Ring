"use client";

import { useEffect, useState } from "react";
import { DrinkStatus } from "@/components/DrinkVote";
import { Flame } from "@/components/Flame";
import { GameIcon } from "@/components/GameIcon";
import { PendingPenalty } from "@/components/PenaltyCard";
import { HallOfLegends } from "@/components/HallOfLegends";
import { JoinQR } from "@/components/JoinQR";
import { RoadToDoom } from "@/components/RoadToDoom";
import { SidePrizes } from "@/components/SidePrizes";
import { FullscreenToggle } from "@/components/FullscreenToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { Standings } from "@/components/Standings";
import { TvStage } from "@/components/TvStage";
import { GAME_LABELS } from "@/lib/config";
import { useParty } from "@/lib/party";
import { ago, coldPlayerIds, topRivalry, tylerRecord } from "@/lib/banter";
import { mastery } from "@/lib/prizes";
import { hotPlayerIds } from "@/lib/scoring";
import { useNow } from "@/lib/useNow";

// Full-screen display for a TV: standings on the left; curse status, a
// rotating card (side prizes ↔ join QR) and a live event feed on the right.
// After the host ends the competition it shows the Hall of Legends instead.
const ROTATE_MS = 12_000;

export default function TvPage() {
  const { raw, derived, error } = useParty();
  const now = useNow(15_000);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => s + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  if (!raw || !derived) {
    return (
      <TvStage>
        <p className="muted">{error ? `Can't reach the scoreboard: ${error}` : "Summoning the scoreboard…"}</p>
      </TvStage>
    );
  }

  // Once the host ends the competition, the TV becomes the awards screen.
  if (raw.settings.ended_at) return <HallOfLegends raw={raw} derived={derived} />;

  const { settings, players } = raw;
  const byId = new Map(players.map((p) => [p.id, p]));
  const winner = derived.grandWinner ? byId.get(derived.grandWinner.playerId) : null;
  const curse = derived.curse;
  const rival = topRivalry(derived.standings);
  const record = derived.tyler ? tylerRecord(derived.tyler, raw.events) : null;
  // Rotating card: join QR, then side prizes and Tyler's record once they exist.
  const cards = [
    "qr",
    ...(derived.sidePrizes.length > 0 ? ["prizes"] : []),
    ...(record && record.wins + record.losses > 0 ? ["record"] : []),
  ];
  const card = cards[slide % cards.length];
  const feed = [...raw.events].sort((a, b) => b.seq - a.seq).slice(0, 5);

  return (
    <TvStage>
      <header className="tv-head">
        <div>
          <h1>The Fellowship Standings</h1>
          <div className="runes" aria-hidden>
            ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ
          </div>
        </div>
        <span className="spacer" />
        {rival && (
          <span className="chip chip-rival tv-goal">
            ⚔️ {rival.a.name} vs {rival.b.name} ·{" "}
            {rival.gap === 0 ? `dead even at ${rival.total}` : "one point apart"}
          </span>
        )}
        <span className="chip chip-gold tv-goal">First to {settings.win_threshold} is crowned</span>
        <FullscreenToggle />
        <SoundToggle />
      </header>

      {winner && (
        <div className="banner tv-banner">
          👑 {winner.name} is the grand winner
          {derived.grandWinner!.reason === "fallback" ? " (highest total when the host called it)" : ""}!
        </div>
      )}

      <div className="tv-road">
        <RoadToDoom
          players={players}
          totals={derived.totals}
          threshold={settings.win_threshold}
          curse={curse}
          winnerId={winner?.id}
        />
      </div>

      <div className="tv-grid">
        <Standings
          standings={derived.standings}
          threshold={settings.win_threshold}
          curse={curse}
          winnerId={winner?.id}
          hotIds={hotPlayerIds(raw.events, now)}
          coldIds={coldPlayerIds(players, raw.events, now)}
          masterId={mastery(players, raw.events).master?.id}
          compact
          twoColumns
        />

        <aside className="tv-side">
          {derived.tyler && curse.status !== "disabled" && (
            <section className={`curse ${curse.status === "lifted" ? "lifted" : ""}`}>
              {curse.status === "cursed" ? (
                <>
                  <b className="display curse-title"><Flame /> {derived.tyler.name} is cursed</b>
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    Streak{" "}
                    <span className="streak">
                      {Array.from({ length: settings.tyler_streak_length }, (_, i) => (
                        <i key={i} className={i < curse.streak ? "on" : ""} />
                      ))}
                    </span>{" "}
                    · ring returns at {settings.win_threshold} pts or {settings.tyler_streak_length} straight wins
                  </p>
                  <PendingPenalty />
                </>
              ) : (
                <b className="display">💍 The ring has returned to {derived.tyler.name}</b>
              )}
            </section>
          )}
          <DrinkStatus />

          <section key={card} className="panel tv-rotator">
            {card === "prizes" ? (
              <>
                <h2 style={{ marginTop: 0 }}>Side prizes</h2>
                <SidePrizes prizes={derived.sidePrizes} />
              </>
            ) : card === "record" && record && derived.tyler ? (
              <>
                <h2 style={{ marginTop: 0 }}>{derived.tyler.name}&apos;s record</h2>
                <ul className="record">
                  {record.games.map((g) => (
                    <li key={g.game}>
                      <GameIcon game={g.game} size={20} className="inline-icon" />
                      {GAME_LABELS[g.game] ?? g.game}
                      <span className="wl">
                        {g.wins} <span className="muted">–</span> <span className="l">{g.losses}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="record-foot muted">
                  {record.lastWinAt
                    ? `Last win: ${ago(now - record.lastWinAt)} ago`
                    : `Still waiting on his first win (0 for ${record.losses}).`}
                </p>
              </>
            ) : (
              <div className="tv-join">
                <JoinQR showUrl={false} />
                <div>
                  <h2 style={{ marginTop: 0 }}>Join the quest</h2>
                  <p className="muted">Scan, tap your name, and report every win.</p>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Latest deeds</h2>
            <ul className="feed">
              {feed.map((e) => {
                const who = byId.get(e.player_id)?.name ?? "?";
                const loss = e.delta < 0;
                return (
                  <li key={e.id} className={loss ? "loss" : ""}>
                    <GameIcon game={e.game} size={20} className="inline-icon" />
                    <span>
                      <b>{who}</b> {loss ? "lost" : "won"} {GAME_LABELS[e.game] ?? e.game}
                    </span>
                    <span className="spacer" />
                    <b className={loss ? "neg" : "pos"}>{loss ? "−1" : "+1"}</b>
                  </li>
                );
              })}
              {feed.length === 0 && <li className="muted">No deeds yet. The road awaits.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </TvStage>
  );
}
