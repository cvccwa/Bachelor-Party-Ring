"use client";

import { setSoundEnabled, useSoundEnabled } from "@/lib/sound";

export function SoundToggle() {
  const on = useSoundEnabled();
  return (
    <button
      className={`btn sound-toggle ${on ? "on" : ""}`}
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      title={on ? "Mute sound effects" : "Turn on sound effects"}
    >
      {on ? "🔊 Sound on" : "🔈 Sound off"}
    </button>
  );
}
