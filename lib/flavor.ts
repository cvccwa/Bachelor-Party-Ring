// Original toast copy (no film quotes, per spec).
const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

export const winLine = (name: string, game: string) =>
  pick([
    `+1 for ${name}. The road goes ever onward.`,
    `${name} takes ${game}. Bards are warming up.`,
    `A point for ${name}. Somewhere, a hobbit cheers.`,
    `${name} wins ${game}. The beacons are lit.`,
    `${name} +1. Legends have humbler beginnings.`,
  ]);

export const tylerWinLine = () =>
  pick([
    "Tyler claws back a point. The ring hums, curious.",
    "Tyler +1. The curse loosens its grip… slightly.",
    "A win for the Ringbearer. The shadow flinches.",
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

export const grandWinnerLine = (name: string) => `👑 ${name} is crowned grand winner of the party!`;
