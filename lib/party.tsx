"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONFIG } from "./config";
import { derive, type Derived, type Player, type PointEvent, type Settings } from "./scoring";
import { supabase } from "./supabase";

export type DrinkVote = { player_id: string; created_at: string };
export type DrinkOrder = { id: string; ordered_at: string; drunk_at: string | null; witness_id: string | null };
export type Raw = {
  players: Player[];
  events: PointEvent[];
  settings: Settings;
  drinkVotes: DrinkVote[];
  // The latest drink order (pending or last paid), if any.
  drinkOrder: DrinkOrder | null;
};

const DEFAULT_SETTINGS: Settings = {
  win_threshold: CONFIG.winThreshold,
  tyler_streak_length: CONFIG.tylerStreakLength,
  curse_enabled: true,
  ended_at: null,
};

async function fetchAll(): Promise<Raw> {
  const [p, e, s, v, o] = await Promise.all([
    supabase.from("players").select("id,name,is_tyler,sort_order").order("sort_order"),
    supabase.from("point_events").select("id,seq,player_id,game,delta,created_at").order("seq"),
    supabase.from("settings").select("win_threshold,tyler_streak_length,curse_enabled,ended_at").eq("id", 1).maybeSingle(),
    supabase.from("drink_votes").select("player_id,created_at"),
    supabase.from("drink_orders").select("id,ordered_at,drunk_at,witness_id").order("ordered_at", { ascending: false }).limit(1),
  ]);
  const err = p.error ?? e.error ?? s.error ?? v.error ?? o.error;
  if (err) throw err;
  return {
    players: (p.data ?? []) as Player[],
    events: (e.data ?? []) as PointEvent[],
    settings: (s.data as Settings | null) ?? DEFAULT_SETTINGS,
    drinkVotes: (v.data ?? []) as DrinkVote[],
    drinkOrder: ((o.data ?? [])[0] as DrinkOrder | undefined) ?? null,
  };
}

type Listener = (raw: Raw) => void;

type PartyState = {
  raw: Raw | null;
  derived: Derived | null;
  error: string | null;
  refresh: () => Promise<Raw>;
  // Called with every fresh snapshot (used by the big-moment splashes).
  subscribe: (fn: Listener) => () => void;
};

const PartyCtx = createContext<PartyState | null>(null);

// One live connection for the whole app, shared by every screen and the
// big-moment splashes: initial fetch, Supabase Realtime for instant updates,
// plus a slow poll as a safety net if the socket drops (e.g. phone sleeps).
export function PartyProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Every refresh fetches; a sequence number drops out-of-order responses.
  const latest = useRef(0);
  const listeners = useRef(new Set<Listener>());
  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const refresh = useCallback(async (): Promise<Raw> => {
    const id = ++latest.current;
    try {
      const r = await fetchAll();
      if (id === latest.current) {
        setRaw(r);
        setError(null);
        listeners.current.forEach((fn) => fn(r));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_votes" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "drink_orders" }, onChange)
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

  const value = useMemo(
    () => ({ raw, derived, error, refresh, subscribe }),
    [raw, derived, error, refresh, subscribe],
  );
  return <PartyCtx.Provider value={value}>{children}</PartyCtx.Provider>;
}

export function useParty(): PartyState {
  const ctx = useContext(PartyCtx);
  if (!ctx) throw new Error("useParty must be used inside <PartyProvider>");
  return ctx;
}
