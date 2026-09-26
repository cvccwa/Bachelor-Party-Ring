"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flame } from "@/components/Flame";
import { PenaltyWheel } from "@/components/PenaltyWheel";
import { MASTERY_TITLE } from "@/lib/config";
import { crownLine, drinkDoneLine, drinkOrderedLine, ringBackLine, tylerLostLine } from "@/lib/flavor";
import { detectDrink, detectMoments, detectThrone, drinkSeen, type DrinkSeen, type Moment, type Recap } from "@/lib/moments";
import { useParty, type Raw } from "@/lib/party";
import { setSplashActive } from "@/lib/splashState";
import { play } from "@/lib/sound";
import { usePlayerId } from "@/lib/usePlayerId";
import type { Settings } from "@/lib/scoring";

// Full-screen splashes for the big moments (Tyler loses, ring returns,
// someone is crowned), shown live on every open screen, plus a one-time
// "while you were away" recap when the app is reopened.

type Seen = { seq: number; settings: Settings; drink?: DrinkSeen; throne?: string | null };
type Variant = "curse" | "ring" | "crown" | "rank" | "drink" | "throne" | "gollum";
type Splash =
  | { id: number; type: "moment"; variant: Variant; icon: string; title: string; line: string; penalty?: string }
  | { id: number; type: "recap"; recap: Recap };

const SEEN_KEY = "bpr.seen";
const MOMENT_MS = 5000;
const PENALTY_MS = 8000; // time to read the penalty
const WHEEL_MS = 11000; // TV: spin, land, then read
const RECAP_MS = 12000;

function loadSeen(): Seen | null {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null");
    return v && typeof v.seq === "number" && v.settings ? v : null;
  } catch {
    return null;
  }
}

function saveSeen(seen: Seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode: recap just won't work across reloads */
  }
}

const THRONE_LINES = [
  "The crown is within reach. Everyone else: do something about it.",
  "A new ruler sits atop the Fellowship. For now.",
  "Long may they reign. (About ten minutes, probably.)",
];

function toSplash(m: Moment, id: number, penalty?: string): Splash {
  switch (m.kind) {
    case "tylerLost":
      return { id, type: "moment", variant: "curse", icon: "🔥", title: `Tyler lost ${m.game}`, line: tylerLostLine(), penalty };
    case "throne":
      return {
        id,
        type: "moment",
        variant: "throne",
        icon: "🏰",
        title: m.mine ? "You seize the throne!" : `${m.playerName} seizes the throne!`,
        line: THRONE_LINES[id % THRONE_LINES.length],
      };
    case "gollum":
      return m.on
        ? {
            id,
            type: "moment",
            variant: "gollum",
            icon: "🐟",
            title: "Tyler has become Sméagol",
            line: "The ring has twisted him. He answers to Sméagol until he climbs back above zero.",
          }
        : {
            id,
            type: "moment",
            variant: "ring",
            icon: "🧍",
            title: "Sméagol is Tyler again",
            line: "Back above zero. He remembers his name. Mostly.",
          };
    case "mastery":
      return {
        id,
        type: "moment",
        variant: "crown",
        icon: "🧭",
        title: m.mine ? `You're the ${MASTERY_TITLE}!` : `${m.playerName}: ${MASTERY_TITLE}!`,
        line: "Won every game at least once. A true jack of all trades.",
      };
    case "ringBack":
      return { id, type: "moment", variant: "ring", icon: "💍", title: "The ring returns!", line: ringBackLine(m.reason) };
    case "rankUp":
      return {
        id,
        type: "moment",
        variant: "rank",
        icon: RANK_ICONS[m.title] ?? "⭐",
        title: `You've risen to ${m.title}!`,
        line: RANK_LINES[m.title] ?? "Your legend grows.",
      };
    case "drinkOrdered":
      return { id, type: "moment", variant: "drink", icon: "🍺", title: "Tyler must drink!", line: drinkOrderedLine() };
    case "drinkDone":
      return { id, type: "moment", variant: "drink", icon: "🍻", title: "Tyler drank!", line: drinkDoneLine(m.witness) };
    case "crowned":
      return {
        id,
        type: "moment",
        variant: "crown",
        icon: "👑",
        title: `${m.playerName} is crowned!`,
        line: m.fallback ? "Highest total when the host called it." : crownLine(),
      };
  }
}

const SOUNDS = {
  curse: "curse",
  gollum: "curse",
  ring: "ring",
  rank: "ring",
  drink: "ring",
  crown: "crown",
  throne: "crown",
} as const;

const RANK_ICONS: Record<string, string> = { Hobbit: "🍃", Ranger: "🏹", "Elf-lord": "🌟", Crowned: "👑" };
const RANK_LINES: Record<string, string> = {
  Hobbit: "Back on solid ground. Second breakfast awaits.",
  Ranger: "Rugged, mysterious, suspiciously good at this.",
  "Elf-lord": "Graceful. Ageless. Insufferable about it.",
  Crowned: "You've reached the mark. Songs will be sung.",
};

function momentLine(m: Moment): string {
  switch (m.kind) {
    case "crowned":
      return `👑 ${m.playerName} was crowned grand winner`;
    case "ringBack":
      return "💍 Tyler's curse broke — the ring returned";
    case "rankUp":
      return `${RANK_ICONS[m.title] ?? "⭐"} You rose to ${m.title}`;
    case "drinkOrdered":
      return "🍺 The Fellowship voted — Tyler owed a drink";
    case "drinkDone":
      return `🍻 Tyler drank${m.witness ? ` (seen by ${m.witness})` : ""}`;
    case "throne":
      return `🏰 ${m.mine ? "You" : m.playerName} took the lead`;
    case "gollum":
      return m.on ? "🐟 Tyler fell below zero and became Sméagol" : "🧍 Sméagol climbed back — he's Tyler again";
    case "mastery":
      return `🧭 ${m.mine ? "You" : m.playerName} won every game — ${MASTERY_TITLE}`;
    case "tylerLost":
      return "";
  }
}

export function Moments() {
  const { subscribe } = useParty();
  const path = usePathname();
  const [queue, setQueue] = useState<Splash[]>([]);
  const seen = useRef<Seen | null | undefined>(undefined);
  const away = useRef(true); // first snapshot after opening counts as "coming back"
  const nextId = useRef(1);
  const quiet = useRef(false);
  const myId = usePlayerId();
  const me = useRef<string | null>(null);
  useEffect(() => {
    me.current = myId ?? null;
  }, [myId]);
  useEffect(() => {
    quiet.current = path.startsWith("/host");
  }, [path]);

  const onSnapshot = useCallback((raw: Raw) => {
    if (document.visibilityState !== "visible") return; // catch up via recap on return
    if (seen.current === undefined) seen.current = loadSeen();
    const maxSeq = raw.events.reduce((m, e) => Math.max(m, e.seq), 0);
    const prev = seen.current;
    const throne = detectThrone(prev ? prev.throne : null, raw.players, raw.events, raw.settings, me.current);
    const next: Seen = {
      seq: Math.max(maxSeq, prev?.seq ?? 0),
      settings: raw.settings,
      drink: drinkSeen(raw.drinkOrder),
      throne: throne.throne,
    };
    seen.current = next;
    saveSeen(next);

    const wasAway = away.current;
    away.current = false;
    if (!prev || quiet.current) return; // first ever visit, or host panel

    const found = detectMoments(raw.players, raw.events, raw.settings, prev, me.current);
    const moments = [
      ...detectDrink(prev.drink, raw.drinkOrder, raw.players),
      ...found.moments,
      // the crown outranks the throne
      ...(throne.moment && !found.moments.some((m) => m.kind === "crowned") ? [throne.moment] : []),
    ];
    const { newCount } = found;
    const recap = { ...found.recap, moments };
    if (wasAway) {
      if (newCount > 0 || moments.length > 0) setQueue((q) => [...q, { id: nextId.current++, type: "recap", recap }]);
    } else if (moments.length > 0) {
      const penaltyFor = (m: Moment) =>
        m.kind === "tylerLost" ? raw.penalties.find((p) => p.event_id === m.eventId)?.penalty : undefined;
      setQueue((q) => [...q, ...moments.map((m) => toSplash(m, nextId.current++, penaltyFor(m)))]);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribe(onSnapshot);
    const onVis = () => {
      if (document.visibilityState === "hidden") away.current = true;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [subscribe, onSnapshot]);

  const current = queue[0];
  const onTv = path.startsWith("/tv");
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    setSplashActive(!!current);
    if (current?.type === "moment") play(SOUNDS[current.variant]);
  }, [current]);
  useEffect(() => () => setSplashActive(false), []);

  useEffect(() => {
    if (!current) return;
    const ms =
      current.type === "recap" ? RECAP_MS : current.penalty ? (onTv ? WHEEL_MS : PENALTY_MS) : MOMENT_MS;
    const t = setTimeout(dismiss, ms);
    return () => clearTimeout(t);
  }, [current, dismiss, onTv]);

  if (!current) return null;

  if (current.type === "recap") {
    const r = current.recap;
    const lines = [
      ...r.moments.map(momentLine).filter(Boolean),
      r.tylerLosses > 0 && `🔥 Tyler lost ${r.tylerLosses} time${r.tylerLosses === 1 ? "" : "s"}`,
      r.wins > 0 && `⚔️ ${r.wins} win${r.wins === 1 ? "" : "s"} logged`,
      r.leader && `🏆 Leading: ${r.leader.name} (${r.leader.total})`,
    ].filter(Boolean) as string[];
    return (
      <div key={current.id} className="splash splash-recap" role="dialog" aria-label="While you were away" onClick={dismiss}>
        <div className="splash-card">
          <div className="splash-icon">📜</div>
          <h2 className="splash-title">While you were away…</h2>
          <ul className="recap-list">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button className="btn btn-gold" onClick={dismiss}>
            Onward
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      key={current.id}
      className={`splash splash-${current.variant}`}
      role="alert"
      onClick={dismiss}
    >
      <div className="splash-rays" aria-hidden />
      <div className="splash-particles" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <div className="splash-card">
        <div className="splash-icon">{current.variant === "curse" ? <Flame size="1em" className="flame-big" /> : current.icon}</div>
        <h2 className="splash-title">{current.title}</h2>
        {current.penalty && onTv ? (
          <PenaltyWheel penalty={current.penalty} />
        ) : (
          <>
            <p className="splash-line">{current.line}</p>
            {current.penalty && (
              <p className="splash-penalty">
                <span>⚖️ The wheel decrees</span>
                <b>{current.penalty}</b>
              </p>
            )}
          </>
        )}
        <span className="splash-hint">tap to continue</span>
      </div>
    </div>
  );
}
