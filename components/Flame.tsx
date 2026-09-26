import { useId } from "react";

// Animated cursed flame: three layered tongues (ember, orange, gold core)
// that flicker out of phase, plus sparks drifting up. Replaces the 🔥 emoji
// wherever it marks Tyler's curse. Sized in em so it sits inline with text.
export function Flame({ size = "1.1em", className = "" }: { size?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`flame ${className}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 32 40" width="100%" height="100%">
        <defs>
          <linearGradient id={`${id}o`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#7c2a14" />
            <stop offset=".55" stopColor="#d9542b" />
            <stop offset="1" stopColor="#ff7a3c" stopOpacity=".2" />
          </linearGradient>
          <linearGradient id={`${id}m`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff6a2b" />
            <stop offset="1" stopColor="#ffb347" stopOpacity=".6" />
          </linearGradient>
          <radialGradient id={`${id}c`} cx="50%" cy="75%" r="60%">
            <stop offset="0" stopColor="#fff6d6" />
            <stop offset=".5" stopColor="#ffe39a" />
            <stop offset="1" stopColor="#e0b64a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="flame-outer">
          <path fill={`url(#${id}o)`} d="M16 1 C19 9 27 13 27 24 C27 32 22 38 16 38 C10 38 5 32 5 24 C5 17 10 14 11 7 C13 11 14 13 15 13 C15 9 15 5 16 1 Z" />
        </g>
        <g className="flame-mid">
          <path fill={`url(#${id}m)`} d="M16 11 C18 16 23 19 23 26 C23 31 20 35 16 35 C12 35 9 31 9 26 C9 21 13 19 14 15 C15 17 15.5 18 16 18 Z" />
        </g>
        <g className="flame-core">
          <ellipse cx="16" cy="29" rx="5" ry="7" fill={`url(#${id}c)`} />
        </g>
        <circle className="flame-spark s1" cx="11" cy="14" r="1" fill="#ffb347" />
        <circle className="flame-spark s2" cx="21" cy="12" r=".8" fill="#ff7a3c" />
        <circle className="flame-spark s3" cx="16" cy="6" r=".7" fill="#ffe39a" />
      </svg>
    </span>
  );
}
