"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "./config";
import { derive, type Player, type PointEvent, type Settings } from "./scoring";
import { supabase } from "./supabase";

type Raw = { players: Player[]; events: PointEvent[]; settings: Settings };

const DEFAULT_SETTINGS: Settings = {
  win_threshold: CONFIG.winThreshold,
  tyler_streak_length: CONFIG.tylerStreakLength,
  curse_enabled: true,
  ended_at: null,
};

async function fetchAll(): Promise<Raw> {
  const [p, e, s] = await Promise.all([
    supabase.from("players").select("id,name,is_tyler,sort_order").order("sort_order"),
    supabase.from("point_events").select("id,seq,player_id,game,delta,created_at").order("seq"),
    supabase.from("settings").select("win_threshold,tyler_streak_length,curse_enabled,ended_at").eq("id", 1).maybeSingle(),
  ]);
  const err = p.error ?? e.error ?? s.error;
  if (err) throw err;
  return {
    players: (p.data ?? []) as Player[],
    events: (e.data ?? []) as PointEvent[],
    settings: (s.data as Settings | null) ?? DEFAULT_SETTINGS,
  };
}

// Live party state: initial fetch, Supabase Realtime for instant updates,
// plus a slow poll as a safety net if the socket drops (e.g. phone sleeps).
export function useParty() {
  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Every refresh fetches; a sequence number drops out-of-order responses.
  const latest = useRef(0);

  const refresh = useCallback(async (): Promise<Raw> => {
    const id = ++latest.current;
    try {
      const r = await fetchAll();
      if (id === latest.current) {
        setRaw(r);
        setError(null);
      }
      return r;
    } catch (e) {
      if (id === latest.current) setError((e as Error).message ?? "Can't reach the scoreboard");
      throw e;
    }
  }, []);

  useEffect(() => {
    const onChange = () => void refresh().catch(() => {});
    const first = setTimeout(onChange, 0);
    const channel = supabase
      .channel("party")
      .on("postgres_changes", { event: "*", schema: "public", table: "point_events" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, onChange)
      // (re)subscribing may have missed changes, so refetch whenever we connect
      .subscribe((status) => status === "SUBSCRIBED" && onChange());
    const poll = setInterval(onChange, CONFIG.pollFallbackMs);
    const onVisible = () => document.visibilityState === "visible" && onChange();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const derived = useMemo(
    () => (raw ? derive(raw.players, raw.events, raw.settings) : null),
    [raw],
  );

  return { raw, derived, error, refresh };
}
