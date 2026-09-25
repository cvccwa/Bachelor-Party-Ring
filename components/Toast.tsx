"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Variant = "win" | "curse" | "epic" | "error";
type ToastItem = {
  id: number;
  message: string;
  variant: Variant;
  action?: { label: string; onClick: () => void };
};
type Show = (message: string, opts?: { variant?: Variant; action?: ToastItem["action"]; ms?: number }) => void;

const ToastCtx = createContext<Show>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show: Show = useCallback(
    (message, opts = {}) => {
      const id = nextId.current++;
      const variant = opts.variant ?? "win";
      setItems((xs) => [...xs.slice(-2), { id, message, variant, action: opts.action }]);
      setTimeout(() => dismiss(id), opts.ms ?? (variant === "epic" ? 7000 : 4000));
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
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
