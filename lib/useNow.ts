"use client";

import { useEffect, useState } from "react";

// Wall-clock time that re-renders every `intervalMs` (for "recent" windows).
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
