// Hand-drawn-style line icons for the games, so they look the same on every
// phone (emoji vary by platform). Falls back to the emoji for unknown games.
import { GAME_ICONS } from "@/lib/config";

const PATHS: Record<string, React.ReactNode> = {
  Cornhole: (
    <>
      <path d="M5 20 L9 5 H19 L15 20 Z" />
      <circle cx="13.2" cy="9.5" r="1.8" />
      <path d="M3.5 15.5 q2.2 -1.6 4.2 0 q-2 1.9 -4.2 0 Z" />
    </>
  ),
  "Beer Pong": (
    <>
      <path d="M6 7 H16 L14.6 20 H7.4 Z" />
      <path d="M6.4 10.5 H15.6" />
      <circle cx="18.5" cy="4.5" r="2" />
      <path d="M16.6 6.2 q-1.5 1 -2.6 0.6" strokeDasharray="1 1.4" />
    </>
  ),
  "Axe Throwing": (
    <>
      <path d="M6 21 L16.5 6.5" />
      <path d="M13.2 3.8 q6.6 -1.4 7.6 5.3 q-3.2 -0.8 -5.2 1.6 Z" />
      <path d="M3 6 l2 2 M4 3 l1 2.5 M2 9.5 l2.4 -0.6" />
    </>
  ),
  "Just Dance": (
    <>
      <circle cx="12" cy="4.2" r="1.9" />
      <path d="M12 6.5 L11 13 L7 20 M11 13 L15.5 19.5 M11.5 8.5 L7 6 M11.5 8.5 L17 10.5" />
      <path d="M18.5 3 v4.2 a1.3 1.3 0 1 1 -1 -1.3 M18.5 3 l2 0.6" />
    </>
  ),
  "Super Smash Bros": (
    <>
      <path d="M6.5 8 H17.5 a4 4 0 0 1 3.9 4.9 l-1 4.3 a2.2 2.2 0 0 1 -3.8 0.9 L14.5 16 H9.5 l-2.1 2.1 a2.2 2.2 0 0 1 -3.8 -0.9 l-1 -4.3 A4 4 0 0 1 6.5 8 Z" />
      <path d="M7.5 11 v3 M6 12.5 h3" />
      <circle cx="16" cy="11.4" r="0.6" />
      <circle cx="17.8" cy="13.2" r="0.6" />
    </>
  ),
  Kahoot: (
    <>
      <path d="M4 5.5 a2 2 0 0 1 2 -2 H18 a2 2 0 0 1 2 2 V14 a2 2 0 0 1 -2 2 H10 L6 20 V16 a2 2 0 0 1 -2 -2 Z" />
      <path d="M10 8 a2 2 0 1 1 3 1.7 c-0.7 0.4 -1 0.8 -1 1.6" />
      <circle cx="12" cy="13.4" r="0.5" />
    </>
  ),
};

export function GameIcon({ game, size = 24, className }: { game: string; size?: number; className?: string }) {
  const art = PATHS[game];
  if (!art) return <span className={className}>{GAME_ICONS[game] ?? "🏆"}</span>;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {art}
    </svg>
  );
}
