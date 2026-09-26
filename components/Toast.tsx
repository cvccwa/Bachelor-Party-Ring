"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSplashActive } from "@/lib/splashState";

type Variant = "win" | "curse" | "epic" | "error";
type ToastItem = {
  id: number;
  message: string;
  variant: Variant;
  ms: number;
  action?: { label: string; onClick: () => void };
};
type Show = (message: string, opts?: { variant?: Variant; action?: ToastItem["action"]; ms?: number }) => void;

const ToastCtx = createContext<Show>(() => {});
export const useToast = () => useContext(ToastCtx);

const DEFAULT_MS = 4000;
const WITH_ACTION_MS = 8000; // time to reach an Undo button

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const splashActive = useSplashActive();

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const show: Show = useCallback((message, opts = {}) => {
    const id = nextId.current++;
    const variant = opts.variant ?? "win";
    const ms = opts.ms ?? (opts.action ? WITH_ACTION_MS : DEFAULT_MS);
    setItems((xs) => [...xs.slice(-2), { id, message, variant, ms, action: opts.action }]);
  }, []);

  // Countdowns only run while no splash is up; a splash appearing resets
  // them, so each toast gets its full time once the splash is dismissed.
  useEffect(() => {
    const t = timers.current;
    if (splashActive) {
      t.forEach(clearTimeout);
      t.clear();
      return;
    }
    for (const item of items) {
      if (!t.has(item.id)) t.set(item.id, setTimeout(() => dismiss(item.id), item.ms));
    }
  }, [items, splashActive, dismiss]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite" hidden={splashActive}>
        {items.map((t) => (
          <SwipeToast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// A toast that can be flicked away sideways. Short drags snap back; taps on
// the action button are left alone.
const SWIPE_DISMISS_PX = 80;

function SwipeToast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(0); // -1 / +1 while animating out
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDx(e.clientX - start.current.x);
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) > SWIPE_DISMISS_PX) {
      setLeaving(Math.sign(dx));
      setTimeout(onDismiss, 180);
    } else {
      setDx(0);
    }
  };

  const offset = leaving ? leaving * 480 : dx;
  return (
    <div
      className={`toast toast-${item.variant} ${dragging ? "dragging" : ""}`}
      style={{ transform: `translateX(${offset}px)`, opacity: leaving ? 0 : 1 - Math.min(Math.abs(dx) / 240, 0.7) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span>{item.message}</span>
      {item.action && (
        <button
          className="toast-action"
          onClick={() => {
            item.action!.onClick();
            onDismiss();
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}
