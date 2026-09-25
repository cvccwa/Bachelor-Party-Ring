"use client";

import { useSyncExternalStore } from "react";

// "Who am I on this phone" — localStorage only, no login (per spec).
const KEY = "bpr.playerId";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPlayerId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: choice just won't persist */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

// undefined = not yet known (server render / before hydration)
export function usePlayerId(): string | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
