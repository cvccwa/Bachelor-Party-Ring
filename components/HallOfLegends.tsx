"use client";

import { TvStage } from "@/components/TvStage";
import { Flame } from "@/components/Flame";
import { SidePrizes } from "@/components/SidePrizes";
import { FullscreenToggle } from "@/components/FullscreenToggle";
import { TvThemeToggle } from "@/components/TvThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { GAME_LABELS } from "@/lib/config";
import { podium, tylerTale } from "@/lib/awards";
import type { Raw } from "@/lib/party";
import { rankTitle, type Derived } from "@/lib/scoring";

// Hall of Legends: what the TV shows once the host ends the competition.
// Podium, side prizes, Tyler's tale.
const STEP_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd left-to-right
const STEP_LABEL = ["1st", "2nd", "3rd"];

export function HallOfLegends({ raw, derived }: { raw: Raw; derived: Derived }) {
  const threshold = raw.settings.win_threshold;
  const steps = podium(derived.standings);
  const winner = derived.grandWinner ? raw.players.find((p) => p.id === derived.grandWinner!.playerId) : null;
  const tale = tylerTale(derived, raw.events);

  return (
    <TvStage className="awards">
      <header className="tv-head">
        <div>
          <h1>Hall of Legends</h1>
          <div className="runes" aria-hidden>
            ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛉ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ
          </div>
        </div>
        <span className="spacer" />
        <TvThemeToggle />
        <FullscreenToggle />
        <SoundToggle />
      </header>

      {winner && <p className="awards-crown">👑 {winner.name}, ruler of the party</p>}

      {steps.length === 0 ? (
        <p className="muted">No legends yet — go win something.</p>
      ) : (
        <div className="podium">
          {STEP_ORDER.filter((i) => steps[i]).map((i) => (
            <div key={i} className={`step step-${i + 1}`} style={{ "--d": `${(2 - i) * 0.35}s` } as React.CSSProperties}>
              <div className="step-names">
                {i === 0 && <span className="step-crown">👑</span>}
                {steps[i].map((s) => (
                  <b key={s.player.id}>{s.player.name}</b>
                ))}
                <span className="muted">
                  {steps[i][0].total} pts · {rankTitle(steps[i][0].total, threshold)}
                </span>
              </div>
              <div className="step-block">{STEP_LABEL[i]}</div>
            </div>
          ))}
        </div>
      )}

      <div className="awards-grid">
        {derived.sidePrizes.length > 0 && (
          <section>
            <h2>Side prizes</h2>
            <SidePrizes prizes={derived.sidePrizes} />
          </section>
        )}

        {tale && derived.curse.status !== "disabled" && (
          <section>
            <h2>The Tale of {tale.name}</h2>
            <div className={`curse ${tale.curse.status === "lifted" ? "lifted" : ""}`}>
              <b className="display">
                {tale.curse.status === "lifted"
                  ? `💍 The ring returned — by ${tale.curse.reason === "streak" ? "a winning streak" : "reaching the mark"}`
                  : <><Flame /> Still cursed. The ring remains lost.</>}
              </b>
              <ul className="tale">
                <li>
                  <span>Final score</span>
                  <b>{tale.total}</b>
                </li>
                <li>
                  <span>Wins</span>
                  <b>{tale.wins}</b>
                </li>
                <li>
                  <span>Losses (each −1)</span>
                  <b>{tale.losses}</b>
                </li>
                <li>
                  <span>Best winning streak</span>
                  <b>{tale.bestStreak}</b>
                </li>
                {tale.worstGame && (
                  <li>
                    <span>Nemesis game</span>
                    <b>
                      {GAME_LABELS[tale.worstGame.game] ?? tale.worstGame.game} ({tale.worstGame.losses})
                    </b>
                  </li>
                )}
              </ul>
            </div>
          </section>
        )}
      </div>
    </TvStage>
  );
}
