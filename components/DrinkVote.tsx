"use client";

import { useState } from "react";
import { buzz } from "@/components/Burst";
import { useToast } from "@/components/Toast";
import { drinkState } from "@/lib/drink";
import { useParty } from "@/lib/party";
import { friendlyError, supabase } from "@/lib/supabase";
import { useNow } from "@/lib/useNow";
import { usePlayerId } from "@/lib/usePlayerId";

// "Tyler needs a drink": players who've logged a win vote; a majority orders
// a drink, which locks Tyler's wins until one witness confirms he drank.
// The server enforces every rule; this just shows the state and the buttons.
export function DrinkVote() {
  const { raw, derived, refresh } = useParty();
  const myId = usePlayerId();
  const toast = useToast();
  const now = useNow(15_000);
  const [busy, setBusy] = useState(false);

  if (!raw || !derived?.tyler || !myId) return null;
  const tyler = derived.tyler;
  const ended = !!raw.settings.ended_at;
  const d = drinkState(raw, now);

  async function rpc(fn: "vote_drink" | "unvote_drink" | "confirm_drink") {
    buzz(fn === "confirm_drink" ? [40, 30, 90] : 25);
    setBusy(true);
    const { data, error } = await supabase.rpc(fn, { p_player_id: myId });
    setBusy(false);
    if (error) toast(friendlyError(error), { variant: "error" });
    else if (fn === "vote_drink" && !(data as { ordered?: boolean } | null)?.ordered) toast("Vote cast. 🍺");
    else if (fn === "unvote_drink") toast("Vote taken back.");
    // An ordered/confirmed drink gets a splash for everyone via <Moments />.
    void refresh().catch(() => {});
  }

  if (myId === tyler.id) {
    if (d.pending) {
      return (
        <section className="drink drink-owed" aria-live="polite">
          <b className="display">🍺 The Fellowship demands a drink</b>
          <p className="muted">Your wins are locked until someone sees you drink. Bottoms up.</p>
        </section>
      );
    }
    if (d.votes === 0 || d.cooldownUntil) return null;
    return (
      <section className="drink" aria-live="polite">
        <b className="display">👀 Murmurs of a drink…</b>
        <p className="muted">
          {d.votes} of {d.needed} votes to make you drink. Sleep with one eye open.
        </p>
      </section>
    );
  }

  if (d.pending) {
    return (
      <section className="drink drink-owed" aria-live="polite">
        <b className="display">🍺 {tyler.name} owes a drink!</b>
        <p className="muted">His wins are locked until someone sees him drink it.</p>
        <button className="btn btn-amber big" disabled={busy} onClick={() => rpc("confirm_drink")}>
          I SAW HIM DRINK
        </button>
      </section>
    );
  }

  if (ended) return null;

  if (d.cooldownUntil) {
    const mins = Math.min(10, Math.max(1, Math.ceil((d.cooldownUntil - now) / 60_000)));
    return (
      <section className="drink drink-quiet">
        <span className="muted">
          🍺 {tyler.name} just drank. Drink voting reopens in {mins} min.
        </span>
      </section>
    );
  }

  const canVote = d.voterIds.has(myId);
  const voted = d.votedIds.has(myId);
  return (
    <section className="drink">
      <div className="row">
        <b className="display">🍺 Does {tyler.name} need a drink?</b>
        <span className="spacer" />
        <span className="drink-tally" aria-label={`${d.votes} of ${d.needed} votes`}>
          {Array.from({ length: d.needed }, (_, i) => (
            <i key={i} className={i < d.votes ? "on" : ""} />
          ))}
        </span>
      </div>
      <p className="muted">
        {d.votes} of {d.needed} votes. At {d.needed}, he can&apos;t log a win until he drinks.
      </p>
      {voted ? (
        <button className="btn" disabled={busy} onClick={() => rpc("unvote_drink")}>
          You voted · take it back
        </button>
      ) : (
        <button className="btn btn-amber" disabled={busy || !canVote} onClick={() => rpc("vote_drink")}>
          {canVote ? "Vote: he drinks" : "Log a win to get a vote"}
        </button>
      )}
    </section>
  );
}

// Read-only strip for the leaderboard and TV: the owed drink, or the vote
// tally once anyone has voted. Hidden when there's nothing to say.
export function DrinkStatus() {
  const { raw, derived } = useParty();
  const now = useNow(15_000);
  if (!raw || !derived?.tyler) return null;
  const d = drinkState(raw, now);
  const name = derived.tyler.name;
  if (d.pending) {
    return (
      <section className="drink drink-owed drink-status">
        <b className="display">🍺 {name} owes a drink!</b>
        <p className="muted">No wins for him until someone sees him drink.</p>
      </section>
    );
  }
  if (d.cooldownUntil || d.votes === 0 || raw.settings.ended_at) return null;
  return (
    <section className="drink drink-status">
      <div className="row">
        <b className="display">🍺 Drink vote</b>
        <span className="spacer" />
        <span className="drink-tally" aria-label={`${d.votes} of ${d.needed} votes`}>
          {Array.from({ length: d.needed }, (_, i) => (
            <i key={i} className={i < d.votes ? "on" : ""} />
          ))}
        </span>
      </div>
      <p className="muted">
        {d.votes} of {d.needed} votes to make {name} drink. Vote from the Report tab.
      </p>
    </section>
  );
}
