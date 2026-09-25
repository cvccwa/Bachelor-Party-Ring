"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { crownLine, ringBackLine, tylerLostLine } from "@/lib/flavor";
import { detectMoments, type Moment, type Recap } from "@/lib/moments";
import { useParty, type Raw } from "@/lib/party";
import { setSplashActive } from "@/lib/splashState";
import type { Settings } from "@/lib/scoring";

// Full-screen splashes for the big moments (Tyler loses, ring returns,
// someone is crowned), shown live on every open screen, plus a one-time
// "while you were away" recap when the app is reopened.

type Seen = { seq: number; settings: Settings };
type Splash =
  | { id: number; type: "moment"; variant: "curse" | "ring" | "crown"; icon: string; title: string; line: string }
  | { id: number; type: "recap"; recap: Recap };

const SEEN_KEY = "bpr.seen";
const MOMENT_MS = 5000;
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

function toSplash(m: Moment, id: number): Splash {
  switch (m.kind) {
    case "tylerLost":
      return { id, type: "moment", variant: "curse", icon: "🔥", title: `Tyler lost ${m.game}`, line: tylerLostLine() };
    case "ringBack":
      return { id, type: "moment", variant: "ring", icon: "💍", title: "The ring returns!", line: ringBackLine(m.reason) };
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

function momentLine(m: Moment): string {
  switch (m.kind) {
    case "crowned":
      return `👑 ${m.playerName} was crowned grand winner`;
    case "ringBack":
      return "💍 Tyler's curse broke — the ring returned";
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
  useEffect(() => {
    quiet.current = path.startsWith("/host");
  }, [path]);

  const onSnapshot = useCallback((raw: Raw) => {
    if (document.visibilityState !== "visible") return; // catch up via recap on return
    if (seen.current === undefined) seen.current = loadSeen();
    const maxSeq = raw.events.reduce((m, e) => Math.max(m, e.seq), 0);
    const prev = seen.current;
    const next: Seen = { seq: Math.max(maxSeq, prev?.seq ?? 0), settings: raw.settings };
    seen.current = next;
    saveSeen(next);

    const wasAway = away.current;
    away.current = false;
    if (!prev || quiet.current) return; // first ever visit, or host panel

    const { moments, recap, newCount } = detectMoments(raw.players, raw.events, raw.settings, prev);
    if (wasAway) {
      if (newCount > 0 || moments.length > 0) setQueue((q) => [...q, { id: nextId.current++, type: "recap", recap }]);
    } else if (moments.length > 0) {
      setQueue((q) => [...q, ...moments.map((m) => toSplash(m, nextId.current++))]);
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
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    setSplashActive(!!current);
  }, [current]);
  useEffect(() => () => setSplashActive(false), []);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismiss, current.type === "recap" ? RECAP_MS : MOMENT_MS);
    return () => clearTimeout(t);
  }, [current, dismiss]);

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
        <div className="splash-icon">{current.icon}</div>
        <h2 className="splash-title">{current.title}</h2>
        <p className="splash-line">{current.line}</p>
        <span className="splash-hint">tap to continue</span>
      </div>
    </div>
  );
}
