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
          <div key={t.id} className={`toast toast-${t.variant}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
