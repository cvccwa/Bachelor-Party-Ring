"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { buzz, useBurst } from "@/components/Burst";
import { GameIcon } from "@/components/GameIcon";
import { CONFIG, GAME_LABELS } from "@/lib/config";
import { tylerWinLine, winLine } from "@/lib/flavor";
import { rankTitle } from "@/lib/scoring";
import { friendlyError, supabase } from "@/lib/supabase";
import { useParty } from "@/lib/party";
import { play } from "@/lib/sound";
import { setPlayerId, usePlayerId } from "@/lib/usePlayerId";

export default function ReportPage() {
  const { raw, derived, error, refresh } = useParty();
  const playerId = usePlayerId();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { fire, layer } = useBurst();

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

  async function report(game: string, e: React.MouseEvent) {
    if (!me || busy) return;
    fire(e.clientX, e.clientY);
    buzz(30);
    play("tap");
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

    // Crowned / ring-returned splashes are shown to everyone by <Moments />.
    toast(me.is_tyler && before?.curse.status === "cursed" ? tylerWinLine() : winLine(me.name, game), {
      action: undo,
    });
    void refresh().catch(() => {});
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
          <button key={g} className="game" disabled={busy || ended} onClick={(e) => report(g, e)}>
            <GameIcon game={g} size={44} className="icon" />
            {GAME_LABELS[g] ?? g}
          </button>
        ))}
      </div>
      {layer}
    </>
  );
}
