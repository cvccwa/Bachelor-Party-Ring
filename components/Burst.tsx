"use client";

import { useCallback, useState } from "react";

// Sparkle burst at a tap point. `fire(x, y)` spawns one; each cleans itself up.
type Spark = { id: number; x: number; y: number };
let nextId = 1;

export function useBurst() {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const fire = useCallback((x: number, y: number) => {
    const id = nextId++;
    setSparks((s) => [...s, { id, x, y }]);
    setTimeout(() => setSparks((s) => s.filter((p) => p.id !== id)), 900);
  }, []);
  const layer = (
    <div className="burst-layer" aria-hidden>
      {sparks.map((s) => (
        <span key={s.id} className="burst" style={{ left: s.x, top: s.y }}>
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </span>
      ))}
    </div>
  );
  return { fire, layer };
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS) */
  }
}
