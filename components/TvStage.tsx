"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// The TV screens are laid out for 1920×1080 and scaled to fill whatever
// display they're on (720p projector, 4:3 projector, 4K TV), so the layout
// never falls back to the phone view or scrolls. On a screen that isn't
// 16:9 the stage grows in the spare direction instead of letterboxing.
const BASE_W = 1920;
const BASE_H = 1080;

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const getSize = () => `${window.innerWidth}x${window.innerHeight}`;
const getServerSize = () => `${BASE_W}x${BASE_H}`;

export function TvStage({ className = "", children }: { className?: string; children: ReactNode }) {
  const [vw, vh] = useSyncExternalStore(subscribe, getSize, getServerSize).split("x").map(Number);
  const w = Math.max(BASE_W, (BASE_H * vw) / vh);
  const h = Math.max(BASE_H, (BASE_W * vh) / vw);
  const scale = vw / w;
  return (
    <div className="tv-fit">
      <div className={`tv tv-stage ${className}`} style={{ width: w, height: h, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
