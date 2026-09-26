"use client";

import { PENALTIES } from "@/lib/config";

// The TV's "curse spin": a wheel of penalties that spins and lands on the one
// the server already picked (tyler_penalties), then reveals it.

const SHORT: Record<string, string> = {
  "Switch hands for your next game": "Switch hands",
  "Wear the silly hat": "Silly hat",
  "Take a drink": "Drink!",
  "Gollum voice for 5 minutes": "Gollum voice",
  "Bow to the leader": "Bow",
  "Toast whoever beat you": "Toast them",
  'Say "my precious" before your next turn': "My precious",
  "Narrate your next game like Gandalf": "Gandalf",
};
const COLORS = ["#7c2a14", "#2a1a12", "#9c4a1c", "#3a2014"];

export function PenaltyWheel({ penalty }: { penalty: string }) {
  const segments: string[] = PENALTIES.includes(penalty) ? [...PENALTIES] : [...PENALTIES, penalty];
  const n = segments.length;
  const seg = 360 / n;
  const i = segments.indexOf(penalty);
  // Land segment i's centre under the pointer at the top, after 5 full turns.
  const final = 360 * 5 - (i * seg + seg / 2);
  const R = 100;
  const pt = (deg: number, r = R) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  };

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden />
      <svg viewBox="-110 -110 220 220" className="wheel" aria-hidden>
        <g className="wheel-spin" style={{ "--final": `${final}deg` } as React.CSSProperties}>
          {segments.map((s, k) => {
            const a0 = k * seg, a1 = (k + 1) * seg, mid = a0 + seg / 2;
            return (
              <g key={s}>
                <path
                  d={`M 0 0 L ${pt(a0)} A ${R} ${R} 0 0 1 ${pt(a1)} Z`}
                  fill={COLORS[k % COLORS.length]}
                  stroke="#e0b64a"
                  strokeWidth={1.2}
                />
                <text
                  transform={`rotate(${mid}) translate(0 -62) rotate(90)`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10.5}
                  fontWeight={700}
                  fill="#f3e3c0"
                >
                  {SHORT[s] ?? s.slice(0, 12)}
                </text>
              </g>
            );
          })}
          <circle r={14} fill="#1b1812" stroke="#e0b64a" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={14}>
            💍
          </text>
        </g>
      </svg>
      <p className="wheel-result">
        <span>⚖️ The wheel decrees</span>
        <b>{penalty}</b>
      </p>
    </div>
  );
}
