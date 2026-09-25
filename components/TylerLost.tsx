"use client";

import { useState } from "react";
import { buzz } from "@/components/Burst";
import { GameIcon } from "@/components/GameIcon";
import { useToast } from "@/components/Toast";
import { CONFIG, GAME_LABELS } from "@/lib/config";
import { useParty } from "@/lib/party";
import { friendlyError, supabase } from "@/lib/supabase";

// The communal TYLER LOST button: anyone who saw it can log it (per spec,
// it never relies on Tyler self-reporting). Only shown while he's cursed.
export function TylerLost() {
  const { raw, derived, refresh } = useParty();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!raw || !derived?.tyler || derived.curse.status !== "cursed") return null;
  const ended = !!raw.settings.ended_at;
  const tyler = derived.tyler;

  async function tylerLost(game: string) {
    buzz([60, 40, 140]);
    setBusy(true);
    const { data: eventId, error: err } = await supabase.rpc("tyler_lost", { p_game: game });
    setBusy(false);
    setSheet(false);
    if (err) {
      toast(friendlyError(err), { variant: "error" });
    } else {
      // The splash carries the flavor; this toast is just the Undo handle.
      toast("Tyler −1 logged", {
        variant: "curse",
        ms: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const { data: ok } = await supabase.rpc("undo_event", { p_event_id: eventId });
            toast(ok ? "Undone — Tyler is spared." : "Too late to undo — ask the host.", {
              variant: ok ? "win" : "error",
            });
            void refresh().catch(() => {});
          },
        },
      });
    }
    void refresh().catch(() => {});
  }

  return (
    <>
      <section className="curse tyler-lost">
        <b className="display">🔥 Saw {tyler.name} lose?</b>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Anyone can log it. Each loss costs him 1 while he&apos;s cursed.
        </p>
        <button className="btn btn-ember big" disabled={ended || busy} onClick={() => setSheet(true)}>
          {tyler.name.toUpperCase()} LOST
        </button>
      </section>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => !busy && setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Which game did {tyler.name} lose?</h2>
            <div className="games">
              {CONFIG.games.map((g) => (
                <button key={g} className="game" disabled={busy} onClick={() => tylerLost(g)}>
                  <GameIcon game={g} size={30} />
                  {GAME_LABELS[g] ?? g}
                </button>
              ))}
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={() => setSheet(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
