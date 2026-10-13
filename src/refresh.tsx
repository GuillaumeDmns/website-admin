// Reloads the data of the pages every minute while auto refresh is on and the page is visible, or on demand

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { refreshInterval } from "./config";
import { RefreshContext } from "./data";

const AUTO_REFRESH_KEY = "admin.autoRefresh";

function storedAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_REFRESH_KEY) !== "false";
  } catch {
    return true;
  }
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const [auto, setAutoState] = useState(storedAuto);

  const refreshNow = useCallback(() => setTick((value) => value + 1), []);

  const setAuto = useCallback((value: boolean) => {
    setAutoState(value);
    try {
      localStorage.setItem(AUTO_REFRESH_KEY, String(value));
    } catch {
      // Kept for this page only
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshNow();
    }, refreshInterval);
    return () => window.clearInterval(timer);
  }, [auto, refreshNow]);

  const value = useMemo(() => ({ tick, auto, setAuto, refreshNow }), [tick, auto, setAuto, refreshNow]);
  return <RefreshContext value={value}>{children}</RefreshContext>;
}
