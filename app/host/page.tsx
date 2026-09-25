"use client";

import { useState } from "react";
import { JoinQR } from "@/components/JoinQR";
import { useToast } from "@/components/Toast";
import { CONFIG } from "@/lib/config";
import { friendlyError, supabase } from "@/lib/supabase";
import { useParty } from "@/lib/party";

// Hidden host panel. Guarded by a shared PIN checked inside Postgres
// (private.admin); the PIN lives only in this tab's memory.
export default function HostPage() {
  const [pin, setPin] = useState<string | null>(null);
  return pin ? <Panel pin={pin} onLock={() => setPin(null)} /> : <PinGate onUnlock={setPin} />;
}

function PinGate({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("admin_check_pin", { p_pin: value });
    if (error) setErr(friendlyError(error));
    else onUnlock(value);
  }
  return (
    <form onSubmit={submit}>
      <h1>Host panel</h1>
      <p className="sub">Enter the host PIN.</p>
      <div className="row">
        <input
          className="pin"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button className="btn btn-gold">Enter</button>
      </div>
      {err && <p style={{ color: "#f88" }}>{err}</p>}
    </form>
  );
}

function Panel({ pin, onLock }: { pin: string; onLock: () => void }) {
  const { raw, derived, refresh } = useParty();
  const toast = useToast();
  if (!raw || !derived) return <p className="muted">Loading…</p>;

  const byId = new Map(raw.players.map((p) => [p.id, p]));

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    const { error } = await supabase.rpc(fn, { p_pin: pin, ...args });
    if (error) toast(friendlyError(error), { variant: "error" });
    else toast(ok);
    void refresh().catch(() => {});
    if (error?.message.includes("bad_pin")) onLock();
  }

  const s = raw.settings;
  const ended = !!s.ended_at;
  const recent = [...raw.events].sort((a, b) => b.seq - a.seq);

  return (
    <>
      <div className="row">
        <h1>Host panel</h1>
        <span className="spacer" />
        <button className="btn" onClick={onLock}>
          Lock
        </button>
      </div>

      <h2>Rules</h2>
      <form
        className="panel"
        key={`${s.win_threshold}-${s.tyler_streak_length}-${s.curse_enabled}`}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void call(
            "admin_update_settings",
            {
              p_win_threshold: Number(f.get("threshold")),
              p_tyler_streak_length: Number(f.get("streak")),
              p_curse_enabled: f.get("curse") === "on",
            },
            "Rules updated.",
          );
        }}
      >
        <label className="field">
          Win threshold (points to be crowned)
          <input name="threshold" type="number" min={1} max={100} defaultValue={s.win_threshold} required />
        </label>
        <label className="field">
          Tyler&apos;s streak to lift the curse
          <input name="streak" type="number" min={1} max={50} defaultValue={s.tyler_streak_length} required />
        </label>
        <label className="check">
          <input name="curse" type="checkbox" defaultChecked={s.curse_enabled} /> Ring curse active (uncheck to kill
          the mechanic)
        </label>
        <button className="btn btn-gold">Save rules</button>
      </form>

      <h2>Competition</h2>
      <div className="panel">
        {ended ? (
          <>
            <p style={{ marginTop: 0 }}>
              Ended at {new Date(s.ended_at!).toLocaleTimeString()}.{" "}
              {derived.grandWinner && <>Winner: {byId.get(derived.grandWinner.playerId)?.name}.</>}
            </p>
            <button className="btn" onClick={() => call("admin_set_ended", { p_ended: false }, "Competition reopened.")}>
              Reopen competition
            </button>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }} className="muted">
              Ending locks scoring. If nobody has reached {s.win_threshold}, the highest total is crowned.
            </p>
            <button
              className="btn btn-ember"
              onClick={() =>
                confirm("End the competition now?") &&
                call("admin_set_ended", { p_ended: true }, "Competition ended.")
              }
            >
              End competition
            </button>
          </>
        )}
      </div>

      <h2>Roster</h2>
      <div className="panel">
        <div style={{ display: "grid", gap: 6 }}>
          {raw.players.map((p) => (
            <RosterRow
              key={p.id + p.name}
              name={p.name}
              tag={p.is_tyler ? "Ringbearer" : undefined}
              onSave={(name) => call("admin_upsert_player", { p_id: p.id, p_name: name }, "Renamed.")}
            />
          ))}
          {raw.players.length < CONFIG.maxPlayers && (
            <RosterRow
              key={`new-${raw.players.length}`}
              name=""
              placeholder="Add a guest…"
              onSave={(name) => call("admin_upsert_player", { p_id: null, p_name: name }, `Added ${name}.`)}
            />
          )}
        </div>
      </div>

      <h2>Event log ({recent.length})</h2>
      <p className="sub">Fix a mis-tap by deleting it. Totals recompute instantly.</p>
      <ul className="log">
        {recent.map((e) => (
          <li key={e.id}>
            <span className="muted">{new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            <b style={{ color: e.delta > 0 ? "var(--gold)" : "var(--ember)" }}>{e.delta > 0 ? "+1" : "−1"}</b>
            <span>{byId.get(e.player_id)?.name ?? "?"}</span>
            <span className="muted">{e.game}</span>
            <span className="spacer" />
            <button
              className="btn"
              onClick={() => call("admin_delete_event", { p_event_id: e.id }, "Event deleted.")}
              aria-label="Delete event"
            >
              ✕
            </button>
          </li>
        ))}
        {recent.length === 0 && <li className="muted">No events yet.</li>}
      </ul>

      <h2>Big screens</h2>
      <div className="panel row">
        <a className="btn btn-gold" href="/tv" target="_blank" rel="noreferrer">
          📺 Open TV mode
        </a>
        <span className="muted">The TV switches to the Hall of Legends when you end the competition.</span>
      </div>

      <h2>Table-tent QR</h2>
      <div className="panel">
        <JoinQR />
      </div>
    </>
  );
}

function RosterRow({
  name,
  tag,
  placeholder,
  onSave,
}: {
  name: string;
  tag?: string;
  placeholder?: string;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  const dirty = value.trim() !== name && value.trim().length > 0;
  return (
    <form
      className="roster-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) onSave(value.trim());
      }}
    >
      <input
        className="roster-input"
        value={value}
        placeholder={placeholder}
        maxLength={30}
        onChange={(e) => setValue(e.target.value)}
      />
      {tag && <span className="chip chip-ember">{tag}</span>}
      <button className="btn" disabled={!dirty}>
        Save
      </button>
    </form>
  );
}
