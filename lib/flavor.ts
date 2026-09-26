// Original toast copy (no film quotes, per spec).
const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

const WIN_LINES = (name: string, game: string) => [
  `+1 for ${name}. The road goes ever onward.`,
  `${name} takes ${game}. Bards are warming up.`,
  `A point for ${name}. Somewhere, a hobbit cheers.`,
  `${name} wins ${game}. The beacons are lit.`,
  `${name} +1. Legends have humbler beginnings.`,
  `${name} claims ${game}. Write it in the Red Book.`,
  `Another notch on ${name}'s walking staff.`,
  `${name} +1. The innkeeper pours a round in their honor.`,
  `Victory for ${name}! The eagles are mildly impressed.`,
  `${name} wins ${game}. Somewhere, a dwarf grumbles about it.`,
  `+1 ${name}. Second breakfast has been earned.`,
  `${name} takes the point. The Fellowship nods approvingly.`,
  `${name} wins. Composing a ballad, verse one of many.`,
];

// Game-specific lines, mixed in some of the time.
const GAME_LINES: Record<string, (name: string) => string[]> = {
  Cornhole: (n) => [`${n} sinks the bag. Hobbit-grade precision.`, `Straight through the hole. ${n} +1.`],
  "Beer Pong": (n) => [`${n} drains the cup. The Prancing Pony approves.`, `Splash! ${n} +1 and one fewer cup.`],
  "Axe Throwing": (n) => [`Thunk. ${n} +1. Gimli would weep with pride.`, `${n} splits the target. Dwarves take note.`],
  "Just Dance": (n) => [`${n} dances like the elves are watching. +1.`, `Nimble feet! ${n} +1.`],
  "Super Smash Bros": (n) => [`${n} smashes the realm. +1.`, `${n} wins the brawl. Button-mashing becomes legend.`],
  Kahoot: (n) => [`${n} knows things. +1.`, `Wisdom of the ancients: ${n} +1.`],
};

export const winLine = (name: string, game: string) => {
  const specific = GAME_LINES[game]?.(name) ?? [];
  return specific.length && Math.random() < 0.4 ? pick(specific) : pick(WIN_LINES(name, game));
};

export const tylerWinLine = () =>
  pick([
    "Tyler claws back a point. The ring hums, curious.",
    "Tyler +1. The curse loosens its grip… slightly.",
    "A win for the Ringbearer. The shadow flinches.",
    "Tyler +1. Hope, faint as a distant beacon.",
    "The Ringbearer strikes back. +1.",
    "Tyler wins one. The curse makes a note of it.",
    "+1 Tyler. The dark lord sighs.",
  ]);

export const tylerLostLine = () =>
  pick([
    "Tyler −1. The curse deepens.",
    "Another loss. The ring grows heavier in Tyler's pocket.",
    "Tyler −1. Somewhere, something whispers \"precious.\"",
    "The shadow lengthens over Tyler. −1.",
  ]);

export const ringBackLine = (reason: "threshold" | "streak") =>
  reason === "streak"
    ? "THE CURSE IS BROKEN! Tyler strung the wins together — the ring returns!"
    : "THE CURSE IS BROKEN! Tyler hit the mark — the ring returns!";

export const crownLine = () =>
  pick([
    "Grand winner of the party. All shall kneel.",
    "The realm has a new ruler. Bow accordingly.",
    "Songs will be sung. Mostly off-key.",
    "First to the mark — glory eternal (until next year).",
  ]);
