"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { CONFIG, GAME_ICONS, GAME_LABELS } from "@/lib/config";
import { grandWinnerLine, ringBackLine, tylerWinLine, winLine } from "@/lib/flavor";
import { derive, rankTitle } from "@/lib/scoring";
import { friendlyError, supabase } from "@/lib/supabase";
import { useParty } from "@/lib/useParty";
import { setPlayerId, usePlayerId } from "@/lib/usePlayerId";

export default function ReportPage() {
  const { raw, derived, error, refresh } = useParty();
  const playerId = usePlayerId();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!raw || !derived || playerId === undefined) {
    return <p className="muted">{error ? `Can't reach the scoreboard: ${error}` : "Summoning the scoreboard…"}</p>;
  }

  const me = raw.players.find((p) => p.id === playerId) ?? null;

  if (!me) {
    return (
      <>
        <h1>Who goes there?</h1>
        <p className="sub">Tap your name. This phone will remember you.</p>
        <div className="names">
          {raw.players.map((p) => (
            <button key={p.id} onClick={() => setPlayerId(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </>
    );
  }

  const ended = !!raw.settings.ended_at;
  const total = derived.totals.get(me.id) ?? 0;
  const threshold = raw.settings.win_threshold;

  async function report(game: string) {
    if (!me || busy) return;
    setBusy(true);
    const before = derived;
    const { data: eventId, error: err } = await supabase.rpc("report_win", { p_player_id: me.id, p_game: game });
    setBusy(false);
    if (err) {
      toast(friendlyError(err), { variant: "error" });
      return;
    }
    const undo = {
      label: "Undo",
      onClick: async () => {
        const { data: ok } = await supabase.rpc("undo_event", { p_event_id: eventId });
        toast(ok ? "Undone." : "Too late to undo — ask the host.", { variant: ok ? "win" : "error" });
        void refresh().catch(() => {});
      },
    };

    let after = null;
    try {
      const r = await refresh();
      after = derive(r.players, r.events, r.settings);
    } catch {
      /* toast anyway */
    }

    if (after?.grandWinner && !before?.grandWinner && after.grandWinner.playerId === me.id) {
      toast(grandWinnerLine(me.name), { variant: "epic", action: undo });
    } else if (me.is_tyler && after?.curse.status === "lifted" && before?.curse.status === "cursed") {
      toast(ringBackLine(after.curse.reason), { variant: "epic", action: undo });
    } else {
      toast(me.is_tyler && before?.curse.status === "cursed" ? tylerWinLine() : winLine(me.name, game), {
        action: undo,
      });
    }
  }

  return (
    <>
      <div className="me">
        <span className="name">{me.name}</span>
        <span className="chip chip-gold">
          {total} pt{total === 1 ? "" : "s"} · {rankTitle(total, threshold)}
        </span>
        {me.is_tyler && derived.curse.status === "cursed" && <span className="chip chip-ember">Cursed</span>}
        <span className="spacer" />
        <button className="link-btn" onClick={() => setPlayerId(null)}>
          not me
        </button>
      </div>

      {ended && <div className="banner ended">The competition has ended. Check the leaderboard for the crown.</div>}
      {derived.grandWinner && !ended && (
        <div className="banner">
          👑 {raw.players.find((p) => p.id === derived.grandWinner!.playerId)?.name} is the grand winner — keep
          playing for side prizes.
        </div>
      )}

      <h1>What did you win?</h1>
      <p className="sub">Tap the game. That&apos;s it. Kahoot: tap once per placement point (1st = 3 taps).</p>
      <div className="games">
        {CONFIG.games.map((g) => (
          <button key={g} className="game" disabled={busy || ended} onClick={() => report(g)}>
            <span className="icon" aria-hidden>
              {GAME_ICONS[g] ?? "🏆"}
            </span>
            {GAME_LABELS[g] ?? g}
          </button>
        ))}
      </div>
    </>
  );
}
