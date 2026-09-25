"use client";

import { useSyncExternalStore } from "react";

// Whether a big-moment splash is on screen. Toasts hold (hidden, timer
// paused) while it is, so an Undo toast isn't buried under the splash.
let active = false;
const listeners = new Set<() => void>();

export function setSplashActive(next: boolean) {
  if (next === active) return;
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useSplashActive(): boolean {
  return useSyncExternalStore(subscribe, () => active, () => false);
}
