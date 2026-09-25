"use client";

import type { CurseState, Player } from "@/lib/scoring";

// "Road to Mount Doom" strip for the TV: a winding road from the Shire
// (0 pts) to Mount Doom (the win threshold), with every player's marker at
// their score. Below zero sinks into the Dead Marshes. Markers glide when
// scores change (CSS transition on transform).

type Pt = { x: number; y: number };
type Seg = [Pt, Pt, Pt, Pt];

const W = 1000;
const H = 190;
const SHIRE: Pt = { x: 150, y: 140 };

// The road as explicit cubic segments, so positions are computed without the DOM.
const SEGMENTS: Seg[] = [
  [SHIRE, { x: 240, y: 70 }, { x: 330, y: 170 }, { x: 450, y: 125 }],
  [{ x: 450, y: 125 }, { x: 570, y: 80 }, { x: 640, y: 70 }, { x: 760, y: 115 }],
  [{ x: 760, y: 115 }, { x: 880, y: 160 }, { x: 860, y: 140 }, { x: 900, y: 100 }],
];
const PATH_D =
  `M ${SHIRE.x} ${SHIRE.y} ` +
  SEGMENTS.map(([, c1, c2, p]) => `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p.x} ${p.y}`).join(" ");

const cubic = ([p0, p1, p2, p3]: Seg, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
};

// Sample the road once into a polyline with cumulative lengths.
const SAMPLES: { p: Pt; len: number }[] = (() => {
  const out: { p: Pt; len: number }[] = [];
  let len = 0;
  let prev: Pt | null = null;
  for (const seg of SEGMENTS) {
    for (let i = 0; i <= 60; i++) {
      const p = cubic(seg, i / 60);
      if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
      out.push({ p, len });
      prev = p;
    }
  }
  return out;
})();
const TOTAL = SAMPLES[SAMPLES.length - 1].len;

function pointAt(frac: number): Pt {
  const target = Math.max(0, Math.min(1, frac)) * TOTAL;
  const i = SAMPLES.findIndex((s) => s.len >= target);
  if (i <= 0) return SAMPLES[0].p;
  const a = SAMPLES[i - 1], b = SAMPLES[i];
  const k = (target - a.len) / (b.len - a.len || 1);
  return { x: a.p.x + (b.p.x - a.p.x) * k, y: a.p.y + (b.p.y - a.p.y) * k };
}

// Landmarks on the Fellowship's way, placed by fraction of the journey so
// they stay put whatever the threshold is.
const LANDMARKS: { name: string; at: number; glyph: "inn" | "hill" | "arch" | "door" | "tree" | "stair" }[] = [
  { name: "Bree", at: 0.14, glyph: "inn" },
  { name: "Weathertop", at: 0.28, glyph: "hill" },
  { name: "Rivendell", at: 0.42, glyph: "arch" },
  { name: "Moria", at: 0.57, glyph: "door" },
  { name: "Lothlórien", at: 0.71, glyph: "tree" },
  { name: "Cirith Ungol", at: 0.86, glyph: "stair" },
];

function Glyph({ kind, x, y }: { kind: (typeof LANDMARKS)[number]["glyph"]; x: number; y: number }) {
  const s = { fill: "none", stroke: "var(--road-ink)", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const g = (children: React.ReactNode) => <g transform={`translate(${x - 9} ${y - 9})`}>{children}</g>;
  switch (kind) {
    case "inn": // a little house with a lit window
      return g(<><path {...s} d="M2 9 L9 3 L16 9 V17 H2 Z" /><rect x="7" y="11" width="4" height="4" fill="#e0b64a" /></>);
    case "hill": // a hill topped by a ruined tower
      return g(<><path {...s} d="M0 17 Q9 3 18 17" /><path {...s} d="M8 8 V3 H11 V8" /></>);
    case "arch": // elven arch over a waterfall
      return g(<><path {...s} d="M3 17 V8 Q9 1 15 8 V17" /><path d="M9 7 V17" stroke="#8ec5e8" strokeWidth={1.6} /></>);
    case "door": // the mountain door
      return g(<><path {...s} d="M0 17 L9 1 L18 17" /><path {...s} d="M6.5 17 V11 Q9 8 11.5 11 V17" /></>);
    case "tree": // golden mallorn tree
      return g(<><path {...s} d="M9 17 V9" /><circle cx="9" cy="7" r="5.5" fill="#e0b64a55" stroke="#e0b64a" strokeWidth={1.4} /></>);
    case "stair": // a steep stair into the dark
      return g(<path {...s} d="M1 17 H5 V13 H9 V9 H13 V5 H17 V1" />);
  }
}

type Props = {
  players: Player[];
  totals: Map<string, number>;
  threshold: number;
  curse: CurseState;
  winnerId?: string | null;
};

const MAX_STACK = 3;
const STEP = 25;

export function RoadToDoom({ players, totals, threshold, curse, winnerId }: Props) {
  const leaderPts = Math.max(0, ...players.map((p) => totals.get(p.id) ?? 0));

  // Group by position (clamped to Mount Doom); below zero lives in the marsh.
  const groups = new Map<string, Player[]>();
  for (const p of [...players].sort((a, b) => a.sort_order - b.sort_order)) {
    const pts = totals.get(p.id) ?? 0;
    const key = pts < 0 ? "marsh" : String(Math.min(pts, threshold));
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const markers: { p: Player; x: number; y: number; baseY: number }[] = [];
  const overflow: { key: string; x: number; y: number; n: number }[] = [];
  for (const [key, list] of groups) {
    const base = key === "marsh" ? { x: 62, y: 142 } : pointAt(Number(key) / threshold);
    // Put Tyler and the leader at the bottom of a stack so they're never hidden.
    const ordered = [...list].sort((a, b) => Number(b.is_tyler) - Number(a.is_tyler) || Number(b.id === winnerId) - Number(a.id === winnerId));
    ordered.slice(0, MAX_STACK).forEach((p, i) => markers.push({ p, x: base.x, y: base.y - 22 - i * STEP, baseY: base.y }));
    if (list.length > MAX_STACK) overflow.push({ key, x: base.x, y: base.y - 22 - MAX_STACK * STEP, n: list.length - MAX_STACK });
  }

  const crowned = !!winnerId;

  return (
    <svg className="road" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Road to Mount Doom: each player's position">
      <defs>
        <radialGradient id="road-lava" cx="50%" cy="20%" r="70%">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset=".45" stopColor="#d9542b" />
          <stop offset="1" stopColor="#3a1408" />
        </radialGradient>
        <radialGradient id="road-bog" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3e5a4c" />
          <stop offset="1" stopColor="#1b2620" />
        </radialGradient>
        <filter id="road-soft">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Dead Marshes */}
      <ellipse cx="62" cy="150" rx="54" ry="24" fill="url(#road-bog)" stroke="#4f6b5a" strokeWidth={1.5} />
      <path d="M34 146 q7 -7 14 0 M66 158 q7 -7 14 0 M82 142 q5 -5 10 0" fill="none" stroke="#7fa08c" strokeWidth={1.5} opacity={0.7} />
      <text x="62" y="186" textAnchor="middle" className="road-land" fill="#8fb09c" fontSize="12">DEAD MARSHES</text>

      {/* The Shire */}
      <path d="M112 156 q28 -40 64 0 Z" fill="#6f9a4e" opacity={0.9} />
      <circle cx="140" cy="148" r="4.5" fill="#e0b64a" />
      <text x="136" y="186" textAnchor="start" className="road-land" fill="#a9c98c" fontSize="13">THE SHIRE</text>

      {/* Mount Doom */}
      <ellipse className={`road-doom-glow ${crowned ? "hot" : ""}`} cx="930" cy="52" rx="58" ry="36" fill="#d9542b" opacity={0.45} filter="url(#road-soft)" />
      <path d="M865 160 L917 50 L943 50 L995 160 Z" fill="#2a1a12" stroke="#5a2a14" strokeWidth={2} />
      <path d="M917 50 L943 50 L937 70 L928 60 L922 74 Z" fill="url(#road-lava)" />
      <text x="930" y="186" textAnchor="middle" className="road-land" fill="#ff9a6b" fontSize="13">MOUNT DOOM</text>

      {/* Road */}
      <path d={PATH_D} fill="none" stroke="#2c2519" strokeWidth={20} strokeLinecap="round" />
      <path d={PATH_D} fill="none" stroke="#6b5530" strokeWidth={2.5} strokeDasharray="2 9" strokeLinecap="round" />

      {/* Landmarks, just below the road */}
      {LANDMARKS.map((l) => {
        const p = pointAt(l.at);
        return (
          <g key={l.name} className="road-landmark">
            <Glyph kind={l.glyph} x={p.x} y={p.y + 26} />
            <text x={p.x} y={p.y + 50} textAnchor="middle" fontSize="11.5">
              {l.name}
            </text>
          </g>
        );
      })}

      {/* Milestones: one per point up to the threshold */}
      {Array.from({ length: Math.max(0, threshold - 1) }, (_, i) => {
        const p = pointAt((i + 1) / threshold);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={7} fill="#1b1812" stroke="#9c7a22" strokeWidth={1.5} />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight={700} fill="#c9a24a">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* Player markers */}
      {markers.map(({ p, x, y, baseY }) => {
        const pts = totals.get(p.id) ?? 0;
        const tylerCursed = p.is_tyler && curse.status === "cursed";
        const tylerFree = p.is_tyler && curse.status === "lifted";
        const lead = pts === leaderPts && pts > 0;
        const fill = tylerCursed ? "#d9542b" : lead || tylerFree ? "#e0b64a" : "#cfc3a8";
        const ink = tylerCursed ? "#fff" : "#1a1406";
        return (
          <g
            key={p.id}
            className={`road-marker ${tylerCursed ? "cursed" : ""}`}
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            <line x1={0} y1={12} x2={0} y2={baseY - y - 6} stroke={fill} strokeWidth={1.5} opacity={0.55} />
            <circle r={12} fill={fill} stroke="#0f0d0a" strokeWidth={2} />
            <text y={4} textAnchor="middle" fontSize="10.5" fontWeight={700} fill={ink}>
              {p.name.slice(0, 2)}
            </text>
            {p.id === winnerId && (
              <text y={-16} textAnchor="middle" fontSize="15">
                👑
              </text>
            )}
            {tylerFree && (
              <text x={13} y={-9} fontSize="11">
                💍
              </text>
            )}
          </g>
        );
      })}
      {overflow.map((o) => (
        <g key={`more-${o.key}`} style={{ transform: `translate(${o.x}px, ${o.y}px)` }} className="road-marker">
          <rect x={-15} y={-10} width={30} height={20} rx={10} fill="#241f17" stroke="#9c7a22" />
          <text y={4} textAnchor="middle" fontSize="10.5" fontWeight={700} fill="#e0b64a">
            +{o.n}
          </text>
        </g>
      ))}
    </svg>
  );
}
