"use client";

import { setTvTheme, useTvTheme } from "@/lib/tvTheme";

export function TvThemeToggle() {
  const theme = useTvTheme();
  const light = theme === "light";
  return (
    <button
      className="btn sound-toggle"
      onClick={() => setTvTheme(light ? "dark" : "light")}
      title={light ? "Switch to the dark theme" : "Switch to the light parchment theme (better on projectors)"}
    >
      {light ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
