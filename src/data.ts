// Data of the pages: each one loads what it shows (useApi), all reloaded together every minute while auto refresh is
// on and the page is visible, or on demand (RefreshProvider in refresh.tsx).

import { createContext, use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { get } from "./api/client";

export interface Refresh {
  /** Changes at each reload */
  tick: number;
  auto: boolean;
  setAuto(auto: boolean): void;
  refreshNow(): void;
}

export const RefreshContext = createContext<Refresh>({ tick: 0, auto: false, setAuto: () => {}, refreshNow: () => {} });

export function useRefresh(): Refresh {
  return use(RefreshContext);
}

export interface Resource<T> {
  data: T | undefined;
  error: Error | undefined;
  /** First load, nothing to show yet */
  loading: boolean;
  /** When the data shown was loaded */
  loadedAt: number | undefined;
  reload(): void;
}

/** GETs [path] (null: nothing), again at each refresh; the previous data stays shown while reloading or after a failure */
export function useApi<T>(path: string | null): Resource<T> {
  const { tick } = useRefresh();
  const [own, setOwn] = useState(0);
  const [state, setState] = useState<{ path: string | null; data?: T; error?: Error; loadedAt?: number }>({ path });

  useEffect(() => {
    if (!path) return;
    let current = true;
    get<T>(path)
      .then((data) => current && setState({ path, data, loadedAt: Date.now() }))
      .catch((error: Error) => current && setState((previous) => ({ ...previous, path, error })));
    return () => {
      current = false;
    };
  }, [path, tick, own]);

  const reload = useCallback(() => setOwn((value) => value + 1), []);
  const samePath = state.path === path;
  return {
    data: samePath ? state.data : undefined,
    error: samePath ? state.error : undefined,
    loading: Boolean(path) && (!samePath || (state.data === undefined && state.error === undefined)),
    loadedAt: samePath ? state.loadedAt : undefined,
    reload,
  };
}

/** Days shown by a page, kept in its URL (?days=90) */
export function usePeriod(fallback: number): [number, (days: number) => void] {
  const [params, setParams] = useSearchParams();
  const days = Number(params.get("days")) || fallback;
  const setDays = useCallback(
    (value: number) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("days", String(value));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [days, setDays];
}
