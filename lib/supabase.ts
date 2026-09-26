import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

// Publishable key only: tables are read-only under RLS, and every write goes
// through a validated SECURITY DEFINER RPC (see supabase/migrations).
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

// Map RPC error messages raised in SQL to something a guest can read.
export function friendlyError(err: { message?: string } | null | undefined): string {
  const msg = err?.message ?? "";
  if (msg.includes("competition_ended")) return "The competition is over — no more points.";
  if (msg.includes("tyler_repeat")) return "No point — Tyler can't score the same game twice in a row. Play something else!";
  if (msg.includes("curse_lifted")) return "The curse is already lifted — Tyler's losses are free now.";
  if (msg.includes("bad_pin")) return "Wrong PIN.";
  if (msg.includes("roster_full")) return "Roster is full.";
  if (msg.includes("unknown_player")) return "That name isn't on the roster anymore — pick again.";
  if (msg.includes("duplicate key")) return "That name is already taken.";
  return msg || "Something went wrong — try again.";
}
