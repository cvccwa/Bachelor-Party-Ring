"use client";

import { useLayoutEffect, useRef } from "react";
import { Flame } from "@/components/Flame";
import { GameIcon } from "@/components/GameIcon";
import { SIDE_PRIZE_SHORT } from "@/lib/config";
import { rankTitle, type CurseState, type Standing } from "@/lib/scoring";

// Leaderboard rows with motion: rows glide to their new rank (FLIP), scores
// count up and flash when they change, and Tyler's row flickers with embers
// while cursed / glows gold once the ring is back.

type Props = {
  standings: Standing[];
  threshold: number;
  curse: CurseState;
  winnerId?: string | null;
  myId?: string | null;
  hotIds?: Set<string>;
  /** player id → games whose side prize they hold (shown as gold badges). */
  prizes?: Map<string, string[]>;
  compact?: boolean;
  /** Split into two columns (ranks run down the first, then the second) on wide screens. */
  twoColumns?: boolean;
};

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Standings({ standings, threshold, curse, winnerId, myId, hotIds, prizes, compact, twoColumns }: Props) {
  const rows = useRef(new Map<string, HTMLLIElement>());
  const lastPos = useRef(new Map<string, { x: number; y: number }>());

  const order = standings.map((s) => s.player.id).join(",");
  useLayoutEffect(() => {
    const motion = !reduceMotion();
    rows.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const prev = lastPos.current.get(id);
      if (motion && prev && (Math.abs(prev.y - r.top) > 1 || Math.abs(prev.x - r.left) > 1)) {
        el.animate([{ transform: `translate(${prev.x - r.left}px, ${prev.y - r.top}px)` }, { transform: "none" }], {
          duration: 650,
          easing: "cubic-bezier(.2,.8,.2,1)",
        });
      }
      lastPos.current.set(id, { x: r.left, y: r.top });
    });
  }, [order]);

  return (
    <ol
      className={`board ${compact ? "board-compact" : ""} ${twoColumns ? "board-cols-2" : ""}`}
      style={{ "--rows": Math.ceil(standings.length / 2) } as React.CSSProperties}
    >
      {standings.map((s) => {
        const isTyler = s.player.is_tyler;
        const cursed = isTyler && curse.status === "cursed";
        const ringBack = isTyler && curse.status === "lifted";
        const hot = hotIds?.has(s.player.id);
        const pct = Math.max(0, Math.min(100, (s.total / threshold) * 100));
        return (
          <li
            key={s.player.id}
            ref={(el) => {
              if (el) rows.current.set(s.player.id, el);
              else rows.current.delete(s.player.id);
            }}
            className={[
              s.rank === 1 && s.total > 0 ? "top" : "",
              cursed ? "cursed" : "",
              ringBack ? "ringback" : "",
              s.player.id === myId ? "me-row" : "",
            ].join(" ")}
          >
            <span className="rank">{s.rank}</span>
            <span className="who">
              <b>
                {winnerId === s.player.id && "👑 "}
                {s.player.name}
                {cursed && <> <Flame /></>}
                {ringBack && " 💍"}
              </b>
              <span className="row" style={{ gap: 6 }}>
                <span className={`chip ${s.total >= threshold ? "chip-gold" : ""}`}>{rankTitle(s.total, threshold)}</span>
                {prizes?.get(s.player.id)?.map((g) => (
                  <span key={g} className="chip chip-prize">
                    <GameIcon game={g} size={12} className="inline-icon" /> {SIDE_PRIZE_SHORT[g] ?? g}
                  </span>
                ))}
                {hot && <span className="chip chip-hot">🔥 On fire</span>}
                {s.losses > 0 && <span className="chip chip-ember">−{s.losses}</span>}
              </span>
              <span className="progress">
                <span style={{ width: `${pct}%` }} />
              </span>
            </span>
            <CountUp value={s.total} className={`pts ${s.total < 0 ? "neg" : ""}`} />
          </li>
        );
      })}
    </ol>
  );
}

// Animates between values by writing textContent directly (no re-renders),
// and flashes a glow whenever the value changes after first paint.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useLayoutEffect(() => {
    const node = el.current;
    const from = shown.current;
    if (!node || from === value) return;
    shown.current = value;
    if (reduceMotion()) {
      node.textContent = String(value);
      return;
    }
    node.animate(
      [
        { transform: "scale(1)", textShadow: "0 0 0 transparent" },
        { transform: "scale(1.35)", textShadow: "0 0 18px currentColor", offset: 0.3 },
        { transform: "scale(1)", textShadow: "0 0 0 transparent" },
      ],
      { duration: 900, easing: "ease-out" },
    );
    const start = performance.now();
    const dur = Math.min(900, 250 * Math.abs(value - from) + 250);
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      node.textContent = String(Math.round(from + (value - from) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      node.textContent = String(value);
    };
  }, [value]);

  return (
    <span ref={el} className={className}>
      {value}
    </span>
  );
}
