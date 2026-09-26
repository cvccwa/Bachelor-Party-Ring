"use client";

import { useSyncExternalStore } from "react";

// One tap to go full screen on a projector or TV with no keyboard (F11).
// Browsers only allow this from a tap/click, so it has to be a button. While
// full screen it also asks the device not to sleep, where supported.

type WakeLock = { release: () => Promise<void> };
let wakeLock: WakeLock | null = null;

function subscribe(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}
const isFull = () => !!document.fullscreenElement;
// Unsupported (e.g. iPhone Safari): no button at all.
const canFull = () => !!document.fullscreenEnabled;

async function toggle() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      await wakeLock?.release();
      wakeLock = null;
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
      wakeLock = (await nav.wakeLock?.request("screen").catch(() => null)) ?? null;
    }
  } catch {
    /* refused by the browser: nothing to do */
  }
}

export function FullscreenToggle() {
  const full = useSyncExternalStore(subscribe, isFull, () => false);
  const supported = useSyncExternalStore(subscribe, canFull, () => false);
  if (!supported) return null;
  return (
    <button className="btn sound-toggle" onClick={toggle} title={full ? "Exit full screen" : "Full screen"}>
      {full ? "🗗 Exit full screen" : "⛶ Full screen"}
    </button>
  );
}
