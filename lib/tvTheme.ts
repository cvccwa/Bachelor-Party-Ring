"use client";

import { useSyncExternalStore } from "react";

// TV/projector colour scheme, remembered per device. "light" is parchment:
// much easier to read on a washed-out projector than the dark theme.
export type TvTheme = "dark" | "light";

const KEY = "bpr.tvTheme";
const listeners = new Set<() => void>();

function read(): TvTheme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTvTheme(): TvTheme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    read,
    () => "dark",
  );
}

export function setTvTheme(t: TvTheme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode: just won't be remembered */
  }
  listeners.forEach((l) => l());
}
