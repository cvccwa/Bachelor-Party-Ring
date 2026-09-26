"use client";

import { useState } from "react";
import { buzz } from "@/components/Burst";
import { useToast } from "@/components/Toast";
import { useParty } from "@/lib/party";
import { friendlyError, supabase } from "@/lib/supabase";
import { usePlayerId } from "@/lib/usePlayerId";

// The latest curse-spin penalty until someone confirms Tyler did it. Older
// unconfirmed ones are simply superseded, so they never pile up.
export function PenaltyCard() {
  const { raw, derived, refresh } = useParty();
  const myId = usePlayerId();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!raw || !derived?.tyler || !myId || raw.settings.ended_at) return null;
  const latest = raw.penalties[raw.penalties.length - 1];
  if (!latest || latest.done_at) return null;
  const tyler = derived.tyler;

  if (myId === tyler.id) {
    return (
      <section className="penalty" aria-live="polite">
        <span className="kicker">⚖️ The wheel decrees</span>
        <b className="display">{latest.penalty}</b>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: ".85rem" }}>
          The Fellowship is watching. Someone will confirm you did it.
        </p>
      </section>
    );
  }

  async function confirm() {
    buzz([40, 30, 90]);
    setBusy(true);
    const { error } = await supabase.rpc("confirm_penalty", { p_player_id: myId, p_penalty_id: latest.id });
    setBusy(false);
    toast(error ? friendlyError(error) : "Penalty served. Justice. ⚖️", { variant: error ? "error" : "win" });
    void refresh().catch(() => {});
  }

  return (
    <section className="penalty" aria-live="polite">
      <span className="kicker">⚖️ {tyler.name}&apos;s penalty</span>
      <b className="display">{latest.penalty}</b>
      <button className="btn btn-ember" disabled={busy} onClick={confirm}>
        HE DID IT
      </button>
    </section>
  );
}

// One-liner for the curse panel on the leaderboard and TV.
export function PendingPenalty() {
  const { raw } = useParty();
  const latest = raw?.penalties[raw.penalties.length - 1];
  if (!raw || !latest || latest.done_at || raw.settings.ended_at) return null;
  return (
    <p className="pending-penalty">
      ⚖️ Penalty owed: <b>{latest.penalty}</b>
    </p>
  );
}
