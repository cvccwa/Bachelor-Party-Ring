// Tunable numbers in one place (see spec "Roster & config").
//
// winThreshold and tylerStreakLength here are only the *defaults*: the live
// values sit in the `settings` table so the host can change them mid-party
// from /host without a deploy. The games list stays in code on purpose —
// adding or removing a game is a one-line change here, not a migration.
export const CONFIG = {
  winThreshold: 7, // points to become grand winner
  tylerLossPenalty: -1, // Tyler-only, per loss (DB enforces delta ∈ {+1, -1})
  tylerStreakLength: 3, // consecutive wins to auto-lift the curse
  games: ["Cornhole", "Beer Pong", "Axe Throwing", "Just Dance", "Super Smash Bros", "Kahoot"],
  maxPlayers: 16,
  pollFallbackMs: 15_000, // safety net if the realtime socket drops
} as const;

export type Game = (typeof CONFIG.games)[number];

// Shorter labels for the button grid.
export const GAME_LABELS: Record<string, string> = {
  "Super Smash Bros": "Smash Bros",
};

export const GAME_ICONS: Record<string, string> = {
  Cornhole: "🌽",
  "Beer Pong": "🍺",
  "Axe Throwing": "🪓",
  "Just Dance": "💃",
  "Super Smash Bros": "🎮",
  Kahoot: "❓",
};

// Side-prize titles for the per-game leader on the leaderboard.
export const SIDE_PRIZE_TITLES: Record<string, string> = {
  Cornhole: "Lord of the Bags",
  "Beer Pong": "Keeper of the Flowing Cup",
  "Axe Throwing": "Axe-lord of the Hills",
  "Just Dance": "Twinkle-Toes of Rivendell",
  "Super Smash Bros": "Warlord of the Four Realms",
  Kahoot: "Wizard of Useless Knowledge",
};

// Short versions of the side-prize titles, for badges on leaderboard rows.
export const SIDE_PRIZE_SHORT: Record<string, string> = {
  Cornhole: "Bags",
  "Beer Pong": "Flowing Cup",
  "Axe Throwing": "Axe-lord",
  "Just Dance": "Twinkle-Toes",
  "Super Smash Bros": "Warlord",
  Kahoot: "Wizard",
};

// House rule: Tyler earns no point for winning the game he last played (win or
// loss). These games are exempt. Enforced in report_win (supabase/migrations).
export const TYLER_REPEAT_EXEMPT = ["Kahoot"];
