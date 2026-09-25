"use client";

import { useSyncExternalStore } from "react";

// Opt-in sound effects, synthesized with Web Audio (no audio files).
// Browsers only allow audio after a user gesture, so the context is created
// and resumed from the toggle's click.

export type Sfx = "crown" | "curse" | "ring" | "tap";

const KEY = "bpr.sound";
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    readEnabled,
    () => false,
  );
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (on) {
    audio()?.resume();
    play("ring");
  }
  listeners.forEach((l) => l());
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function play(kind: Sfx) {
  if (!readEnabled()) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const t = ac.currentTime + 0.02;
  const out = ac.createGain();
  out.gain.value = 0.35;
  out.connect(ac.destination);

  const tone = (type: OscillatorType, freq: number, start: number, dur: number, peak: number, dest: AudioNode = out) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(dest);
    o.start(start);
    o.stop(start + dur + 0.05);
    return o;
  };

  switch (kind) {
    case "crown": {
      // Gong: inharmonic partials with a long decay, then a bright shimmer.
      [
        [1, 0.9],
        [2.76, 0.4],
        [5.4, 0.2],
        [8.93, 0.1],
      ].forEach(([m, g]) => tone("sine", 98 * m, t, 4.5, g));
      [659, 784, 988, 1319].forEach((f, i) => tone("triangle", f, t + 0.5 + i * 0.12, 1.4, 0.18));
      break;
    }
    case "curse": {
      // Ominous: detuned low saws through a lowpass, with a slow wobble.
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      const wob = ac.createGain();
      wob.gain.value = 1;
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.value = 5;
      depth.gain.value = 0.35;
      lfo.connect(depth).connect(wob.gain);
      lp.connect(wob).connect(out);
      lfo.start(t);
      lfo.stop(t + 2.6);
      tone("sawtooth", 55, t, 2.5, 0.5, lp);
      tone("sawtooth", 58.3, t, 2.5, 0.4, lp);
      tone("sine", 41.2, t + 0.2, 2.2, 0.6, lp);
      break;
    }
    case "ring": {
      // Rising chime arpeggio.
      [659, 831, 988, 1319, 1661].forEach((f, i) => tone("triangle", f, t + i * 0.1, 1.2, 0.22));
      break;
    }
    case "tap": {
      tone("triangle", 1568, t, 0.12, 0.12);
      tone("sine", 2349, t + 0.03, 0.15, 0.06);
      break;
    }
  }
}
